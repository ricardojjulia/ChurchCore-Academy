import assert from "node:assert/strict";
import test from "node:test";
import {
  checkGuardianNotification,
} from "@/modules/attendance/guardian-notifier";
import type { AttendanceThresholdDatabase } from "@/modules/attendance/threshold-evaluator";
import type { CommunicationsService } from "@/modules/communications/service";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { CreateCommunicationInput, CommunicationMessage } from "@/modules/communications/types";

const systemActor: AcademyActor = {
  tenantId: "tenant-1",
  userId: "system-1",
  roles: ["institution_admin"],
};

interface MockDatabaseOptions {
  studentAge?: number;
  hasGuardian?: boolean;
  guardianOptedOut?: boolean;
  recentAbsences?: Array<{ sessionDate: string; status: string }>;
  consecutiveTracking?: {
    consecutiveCount: number;
    lastNotificationSentAt?: string;
  };
}

function mockDatabase(options: MockDatabaseOptions = {}) {
  const updates: Array<{ table: string; values: unknown[] }> = [];
  const {
    studentAge = 16,
    hasGuardian = true,
    guardianOptedOut = false,
    recentAbsences = [],
    consecutiveTracking,
  } = options;

  // Calculate date_of_birth based on age
  const today = new Date();
  const birthYear = today.getFullYear() - studentAge;
  const dateOfBirth = `${birthYear}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const db: AttendanceThresholdDatabase = {
    async query(sql: string, values?: unknown[]) {
      // Capture updates
      if (sql.includes("insert into academy_attendance_consecutive_tracking") ||
          sql.includes("update academy_attendance_consecutive_tracking")) {
        updates.push({ table: "consecutive_tracking", values: values || [] });
      }

      if (sql.includes("academy_people") && sql.includes("date_of_birth")) {
        return {
          rows: [{ date_of_birth: dateOfBirth }],
        };
      }

      if (sql.includes("academy_student_relationships")) {
        if (!hasGuardian) {
          return { rows: [] };
        }
        return {
          rows: [
            {
              guardian_person_id: "guardian-1",
              guardian_name: "Parent Guardian",
              has_opted_out: guardianOptedOut,
            },
          ],
        };
      }

      if (sql.includes("academy_attendance_consecutive_tracking") && !sql.includes("insert") && !sql.includes("update")) {
        if (consecutiveTracking) {
          return {
            rows: [
              {
                consecutive_absences: consecutiveTracking.consecutiveCount,
                last_absence_date: "2026-06-24",
                last_notification_sent_at: consecutiveTracking.lastNotificationSentAt,
              },
            ],
          };
        }
        return { rows: [] };
      }

      if (sql.includes("academy_attendance_records") && sql.includes("order by session_date desc")) {
        return {
          rows: recentAbsences.map((a) => ({
            session_date: a.sessionDate,
            status: a.status,
          })),
        };
      }

      if (sql.includes("academy_course_sections")) {
        return {
          rows: [
            {
              section_id: "section-1",
              section_name: "BIB101-A",
              course_name: "Introduction to Scripture",
              instructor_name: "Dr. Smith",
            },
          ],
        };
      }

      if (sql.includes("academy_people") && !sql.includes("date_of_birth")) {
        return {
          rows: [
            {
              id: "student-1",
              display_name: "John Doe",
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  return { db, updates };
}

function mockCommunicationsService() {
  const communications: CreateCommunicationInput[] = [];
  const service: CommunicationsService = {
    async createCommunication(_actor: AcademyActor, input: CreateCommunicationInput) {
      communications.push(input);
      return [] as CommunicationMessage[];
    },
  } as unknown as CommunicationsService;

  return { service, communications };
}

test("student not absent: no notification sent, consecutive tracking reset", async () => {
  const { db, updates } = mockDatabase({ studentAge: 16, hasGuardian: true });
  const { service, communications } = mockCommunicationsService();

  const result = await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "present",
    "class",
    db,
    service,
    systemActor,
  );

  assert.equal(result.notificationSent, false);
  assert.equal(result.reason, "Student not absent");
  assert.equal(communications.length, 0);
  // Should reset consecutive tracking
  assert.ok(updates.some((u) => u.table === "consecutive_tracking"));
});

test("no guardians on file: no notification sent", async () => {
  const { db } = mockDatabase({ studentAge: 16, hasGuardian: false });
  const { service, communications } = mockCommunicationsService();

  const result = await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "absent",
    "class",
    db,
    service,
    systemActor,
  );

  assert.equal(result.notificationSent, false);
  assert.equal(result.reason, "No guardians on file");
  assert.equal(communications.length, 0);
});

test("guardian opted out: no notification sent", async () => {
  const { db } = mockDatabase({ studentAge: 16, hasGuardian: true, guardianOptedOut: true });
  const { service, communications } = mockCommunicationsService();

  const result = await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "absent",
    "class",
    db,
    service,
    systemActor,
  );

  assert.equal(result.notificationSent, false);
  assert.equal(result.reason, "All guardians opted out");
  assert.equal(communications.length, 0);
});

test("spiritual_formation session: notify on first miss regardless of age or consecutive count", async () => {
  const { db } = mockDatabase({ studentAge: 20, hasGuardian: true });
  const { service, communications } = mockCommunicationsService();

  const result = await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "absent",
    "spiritual_formation",
    db,
    service,
    systemActor,
  );

  assert.equal(result.notificationSent, true);
  assert.equal(result.reason, "Spiritual formation absence");
  assert.equal(communications.length, 1);
  assert.equal(communications[0].templateKey, "attendance_concern");
  assert.equal(communications[0].audience.type, "guardian");
});

test("student 18 or older: no notification for regular absence", async () => {
  const { db } = mockDatabase({
    studentAge: 18,
    hasGuardian: true,
    recentAbsences: [
      { sessionDate: "2026-06-25", status: "absent" },
      { sessionDate: "2026-06-24", status: "absent" },
      { sessionDate: "2026-06-23", status: "absent" },
    ],
  });
  const { service, communications } = mockCommunicationsService();

  const result = await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "absent",
    "class",
    db,
    service,
    systemActor,
  );

  assert.equal(result.notificationSent, false);
  assert.equal(result.reason, "Student is 18 or older");
  assert.equal(communications.length, 0);
});

test("3 consecutive absences (minor): notification sent", async () => {
  const { db } = mockDatabase({
    studentAge: 16,
    hasGuardian: true,
    recentAbsences: [
      { sessionDate: "2026-06-25", status: "absent" },
      { sessionDate: "2026-06-24", status: "absent" },
      { sessionDate: "2026-06-23", status: "absent" },
      { sessionDate: "2026-06-22", status: "present" },
    ],
  });
  const { service, communications } = mockCommunicationsService();

  const result = await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "absent",
    "class",
    db,
    service,
    systemActor,
  );

  assert.equal(result.notificationSent, true);
  assert.match(result.reason || "", /3 consecutive absences/);
  assert.equal(communications.length, 1);
  assert.equal(communications[0].templateKey, "attendance_concern");
  assert.equal(communications[0].sourceType, "attendance");
});

test("only 2 consecutive absences: no notification", async () => {
  const { db } = mockDatabase({
    studentAge: 16,
    hasGuardian: true,
    recentAbsences: [
      { sessionDate: "2026-06-25", status: "absent" },
      { sessionDate: "2026-06-24", status: "absent" },
      { sessionDate: "2026-06-23", status: "present" },
    ],
  });
  const { service, communications } = mockCommunicationsService();

  const result = await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "absent",
    "class",
    db,
    service,
    systemActor,
  );

  assert.equal(result.notificationSent, false);
  assert.match(result.reason || "", /Only 2 consecutive absence/);
  assert.equal(communications.length, 0);
});

test("deduplication: already notified within 7 days, no second notification", async () => {
  const lastNotified = new Date();
  lastNotified.setDate(lastNotified.getDate() - 3); // 3 days ago

  const { db } = mockDatabase({
    studentAge: 16,
    hasGuardian: true,
    recentAbsences: [
      { sessionDate: "2026-06-25", status: "absent" },
      { sessionDate: "2026-06-24", status: "absent" },
      { sessionDate: "2026-06-23", status: "absent" },
      { sessionDate: "2026-06-22", status: "absent" },
    ],
    consecutiveTracking: {
      consecutiveCount: 3,
      lastNotificationSentAt: lastNotified.toISOString(),
    },
  });
  const { service, communications } = mockCommunicationsService();

  const result = await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "absent",
    "class",
    db,
    service,
    systemActor,
  );

  assert.equal(result.notificationSent, false);
  assert.equal(result.reason, "Already notified within 7 days");
  assert.equal(communications.length, 0);
});

test("deduplication: notified 8 days ago, send new notification", async () => {
  const lastNotified = new Date();
  lastNotified.setDate(lastNotified.getDate() - 8); // 8 days ago

  const { db } = mockDatabase({
    studentAge: 16,
    hasGuardian: true,
    recentAbsences: [
      { sessionDate: "2026-06-25", status: "absent" },
      { sessionDate: "2026-06-24", status: "absent" },
      { sessionDate: "2026-06-23", status: "absent" },
    ],
    consecutiveTracking: {
      consecutiveCount: 3,
      lastNotificationSentAt: lastNotified.toISOString(),
    },
  });
  const { service, communications } = mockCommunicationsService();

  const result = await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "absent",
    "class",
    db,
    service,
    systemActor,
  );

  assert.equal(result.notificationSent, true);
  assert.equal(communications.length, 1);
});

test("cross-tenant rejection: guardian notification for tenant A cannot be called with actor from tenant B", async () => {
  const { db } = mockDatabase({ studentAge: 16, hasGuardian: true });
  const { service } = mockCommunicationsService();

  const crossTenantActor: AcademyActor = {
    tenantId: "tenant-2",
    userId: "system-2",
    roles: ["institution_admin"],
  };

  await assert.rejects(
    () =>
      checkGuardianNotification(
        "tenant-1",
        "student-1",
        "section-1",
        "2026-06-25",
        "absent",
        "class",
        db,
        service,
        crossTenantActor,
      ),
    /Cross-tenant guardian notification check rejected/,
  );
});

test("communication failure: gracefully handled, returns false", async () => {
  const { db } = mockDatabase({
    studentAge: 16,
    hasGuardian: true,
    recentAbsences: [
      { sessionDate: "2026-06-25", status: "absent" },
      { sessionDate: "2026-06-24", status: "absent" },
      { sessionDate: "2026-06-23", status: "absent" },
    ],
  });

  const failingService: CommunicationsService = {
    async createCommunication() {
      throw new Error("Communication service failed");
    },
  } as unknown as CommunicationsService;

  const result = await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "absent",
    "class",
    db,
    failingService,
    systemActor,
  );

  assert.equal(result.notificationSent, false);
  assert.equal(result.reason, "Communication failed");
});

test("chapel session with guardian: treated as regular absence (not spiritual_formation)", async () => {
  const { db } = mockDatabase({
    studentAge: 16,
    hasGuardian: true,
    recentAbsences: [
      { sessionDate: "2026-06-25", status: "absent" },
      { sessionDate: "2026-06-24", status: "absent" },
    ],
  });
  const { service, communications } = mockCommunicationsService();

  const result = await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "absent",
    "chapel",
    db,
    service,
    systemActor,
  );

  // Chapel is not spiritual_formation, so follows consecutive absence rules
  assert.equal(result.notificationSent, false);
  assert.match(result.reason || "", /Only 2 consecutive absence/);
  assert.equal(communications.length, 0);
});

test("notification does not contain secret field names", async () => {
  const { db } = mockDatabase({
    studentAge: 16,
    hasGuardian: true,
    recentAbsences: [
      { sessionDate: "2026-06-25", status: "absent" },
      { sessionDate: "2026-06-24", status: "absent" },
      { sessionDate: "2026-06-23", status: "absent" },
    ],
  });
  const { service, communications } = mockCommunicationsService();

  await checkGuardianNotification(
    "tenant-1",
    "student-1",
    "section-1",
    "2026-06-25",
    "absent",
    "class",
    db,
    service,
    systemActor,
  );

  if (communications.length > 0) {
    const commJson = JSON.stringify(communications[0]);
    assert.doesNotMatch(commJson, /accessToken/i);
    assert.doesNotMatch(commJson, /credentialSecret/i);
    assert.doesNotMatch(commJson, /rawProviderPayload/i);
    assert.doesNotMatch(commJson, /api.?key/i);
  }
});
