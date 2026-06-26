import assert from "node:assert/strict";
import test from "node:test";
import {
  checkAttendanceThreshold,
  type AttendanceThresholdConfig,
  type AttendanceThresholdDatabase,
} from "@/modules/attendance/threshold-evaluator";
import type { ShepherdAiSuggestion } from "@/modules/shepherd-ai/types";
import type { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import type { CommunicationsService } from "@/modules/communications/service";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { CreateCommunicationInput, CommunicationMessage } from "@/modules/communications/types";

const systemActor: AcademyActor = {
  tenantId: "tenant-1",
  userId: "system-1",
  roles: ["institution_admin"],
};

const defaultConfig: AttendanceThresholdConfig = {
  warningPct: 15.0,
  alertPct: 25.0,
  excusedCounts: false,
};

function mockDatabase(options: {
  absenceCount: number;
  totalMeetings: number;
  recentNotification?: boolean;
}) {
  const db: AttendanceThresholdDatabase = {
    async query(sql: string) {
      if (sql.includes("academy_attendance_records")) {
        return {
          rows: [
            {
              absence_count: options.absenceCount,
              total_meetings: options.totalMeetings,
            },
          ],
        };
      }

      if (sql.includes("academy_course_sections")) {
        return {
          rows: [
            {
              section_id: "section-1",
              section_name: "Bible Study 101 - Fall 2026",
              course_name: "Introduction to Scripture",
              instructor_name: "Dr. Smith",
            },
          ],
        };
      }

      if (sql.includes("academy_people")) {
        return {
          rows: [
            {
              id: "student-1",
              display_name: "John Doe",
            },
          ],
        };
      }

      if (sql.includes("academy_communication_messages")) {
        return {
          rows: options.recentNotification ? [{ recent_notification: true }] : [],
        };
      }

      return { rows: [] };
    },
  };

  return db;
}

function mockShepherdRepo() {
  const suggestions: ShepherdAiSuggestion[] = [];
  const repo: ShepherdAiPostgresRepository = {
    async saveSuggestions(s) {
      suggestions.push(...s);
    },
  } as unknown as ShepherdAiPostgresRepository;

  return { repo, suggestions };
}

function mockCommunicationsService() {
  const communications: CreateCommunicationInput[] = [];
  const service: CommunicationsService = {
    async createCommunication(_actor, input) {
      communications.push(input);
      return [] as CommunicationMessage[];
    },
  } as unknown as CommunicationsService;

  return { service, communications };
}

test("below threshold: no signal, no email", async () => {
  const db = mockDatabase({ absenceCount: 1, totalMeetings: 10 });
  const { repo, suggestions } = mockShepherdRepo();
  const { service, communications } = mockCommunicationsService();

  const result = await checkAttendanceThreshold(
    "tenant-1",
    "student-1",
    "section-1",
    defaultConfig,
    db,
    repo,
    service,
    systemActor,
  );

  assert.equal(result.absenceCount, 1);
  assert.equal(result.totalMeetings, 10);
  assert.equal(result.absenceRate, 10);
  assert.equal(result.warningFired, false);
  assert.equal(result.alertFired, false);
  assert.equal(result.guardianEmailEnqueued, false);
  assert.equal(suggestions.length, 0);
  assert.equal(communications.length, 0);
});

test("at warning threshold (15%): ShepherdAI signal created, no guardian email", async () => {
  const db = mockDatabase({ absenceCount: 3, totalMeetings: 20 });
  const { repo, suggestions } = mockShepherdRepo();
  const { service, communications } = mockCommunicationsService();

  const result = await checkAttendanceThreshold(
    "tenant-1",
    "student-1",
    "section-1",
    defaultConfig,
    db,
    repo,
    service,
    systemActor,
  );

  assert.equal(result.absenceCount, 3);
  assert.equal(result.totalMeetings, 20);
  assert.equal(result.absenceRate, 15);
  assert.equal(result.warningFired, true);
  assert.equal(result.alertFired, false);
  assert.equal(result.guardianEmailEnqueued, false);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].urgency, "medium");
  assert.equal(suggestions[0].workflowCode, "academic_standing_or_credit_progress_review");
  assert.match(suggestions[0].summary, /15%/);
  assert.equal(communications.length, 0);
});

test("at alert threshold (25%): signal created + guardian email enqueued", async () => {
  const db = mockDatabase({ absenceCount: 5, totalMeetings: 20 });
  const { repo, suggestions } = mockShepherdRepo();
  const { service, communications } = mockCommunicationsService();

  const result = await checkAttendanceThreshold(
    "tenant-1",
    "student-1",
    "section-1",
    defaultConfig,
    db,
    repo,
    service,
    systemActor,
  );

  assert.equal(result.absenceCount, 5);
  assert.equal(result.totalMeetings, 20);
  assert.equal(result.absenceRate, 25);
  assert.equal(result.warningFired, true);
  assert.equal(result.alertFired, true);
  assert.equal(result.guardianEmailEnqueued, true);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].urgency, "high");
  assert.match(suggestions[0].summary, /25%/);
  assert.equal(communications.length, 1);
  assert.equal(communications[0].templateKey, "attendance_concern");
  assert.equal(communications[0].audience.type, "guardian");
  assert.equal(communications[0].sourceType, "attendance");
});

test("deduplication: second crossing within 7 days - no second guardian email", async () => {
  const db = mockDatabase({
    absenceCount: 6,
    totalMeetings: 20,
    recentNotification: true,
  });
  const { repo, suggestions } = mockShepherdRepo();
  const { service, communications } = mockCommunicationsService();

  const result = await checkAttendanceThreshold(
    "tenant-1",
    "student-1",
    "section-1",
    defaultConfig,
    db,
    repo,
    service,
    systemActor,
  );

  assert.equal(result.absenceRate, 30);
  assert.equal(result.warningFired, true);
  assert.equal(result.alertFired, true);
  assert.equal(result.guardianEmailEnqueued, false); // Deduplication prevents second email
  assert.equal(suggestions.length, 1); // ShepherdAI signal still fires
  assert.equal(communications.length, 0); // No guardian email sent
});

test("excused absence config = false: excused absences excluded from rate calculation", async () => {
  const config: AttendanceThresholdConfig = {
    warningPct: 15.0,
    alertPct: 25.0,
    excusedCounts: false,
  };

  // Mock database will return 2 absences (unexcused only) out of 10 total
  const db = mockDatabase({ absenceCount: 2, totalMeetings: 10 });
  const { repo, suggestions } = mockShepherdRepo();
  const { service } = mockCommunicationsService();

  const result = await checkAttendanceThreshold(
    "tenant-1",
    "student-1",
    "section-1",
    config,
    db,
    repo,
    service,
    systemActor,
  );

  assert.equal(result.absenceCount, 2);
  assert.equal(result.absenceRate, 20);
  assert.equal(result.warningFired, true); // 20% exceeds 15% warning
  assert.equal(suggestions.length, 1);
});

test("excused absence config = true: excused absences included", async () => {
  const config: AttendanceThresholdConfig = {
    warningPct: 15.0,
    alertPct: 25.0,
    excusedCounts: true,
  };

  // Mock database will return 3 absences (including excused) out of 10 total
  const db = mockDatabase({ absenceCount: 3, totalMeetings: 10 });
  const { repo, suggestions } = mockShepherdRepo();
  const { service } = mockCommunicationsService();

  const result = await checkAttendanceThreshold(
    "tenant-1",
    "student-1",
    "section-1",
    config,
    db,
    repo,
    service,
    systemActor,
  );

  assert.equal(result.absenceCount, 3);
  assert.equal(result.absenceRate, 30);
  assert.equal(result.warningFired, true);
  assert.equal(result.alertFired, true);
  assert.equal(suggestions.length, 1);
});

test("section with 1 total meeting: signal fires with 'Low meeting count' note", async () => {
  const db = mockDatabase({ absenceCount: 1, totalMeetings: 1 });
  const { repo, suggestions } = mockShepherdRepo();
  const { service } = mockCommunicationsService();

  const result = await checkAttendanceThreshold(
    "tenant-1",
    "student-1",
    "section-1",
    defaultConfig,
    db,
    repo,
    service,
    systemActor,
  );

  assert.equal(result.absenceRate, 100);
  assert.equal(result.warningFired, true);
  assert.equal(suggestions.length, 1);
  assert.ok(suggestions[0].explanation.limitations.some((l) => l.includes("Low meeting count")));
  assert.equal(suggestions[0].confidenceScore, 0.6); // Lower confidence for low meeting count
});

test("cross-tenant rejection: threshold check for tenant A cannot write suggestions to tenant B", async () => {
  const db = mockDatabase({ absenceCount: 5, totalMeetings: 10 });
  const { repo } = mockShepherdRepo();
  const { service } = mockCommunicationsService();

  const crossTenantActor: AcademyActor = {
    tenantId: "tenant-2",
    userId: "system-2",
    roles: ["institution_admin"],
  };

  await assert.rejects(
    () =>
      checkAttendanceThreshold(
        "tenant-1",
        "student-1",
        "section-1",
        defaultConfig,
        db,
        repo,
        service,
        crossTenantActor,
      ),
    /Cross-tenant threshold check rejected/,
  );
});

test("zero total meetings: no signal, no email, returns zero stats", async () => {
  const db = mockDatabase({ absenceCount: 0, totalMeetings: 0 });
  const { repo, suggestions } = mockShepherdRepo();
  const { service, communications } = mockCommunicationsService();

  const result = await checkAttendanceThreshold(
    "tenant-1",
    "student-1",
    "section-1",
    defaultConfig,
    db,
    repo,
    service,
    systemActor,
  );

  assert.equal(result.absenceCount, 0);
  assert.equal(result.totalMeetings, 0);
  assert.equal(result.absenceRate, 0);
  assert.equal(result.warningFired, false);
  assert.equal(result.alertFired, false);
  assert.equal(suggestions.length, 0);
  assert.equal(communications.length, 0);
});

test("guardian communication failure does not throw error", async () => {
  const db = mockDatabase({ absenceCount: 6, totalMeetings: 20 });
  const { repo, suggestions } = mockShepherdRepo();

  const failingService: CommunicationsService = {
    async createCommunication() {
      throw new Error("Guardian communication failed");
    },
  } as unknown as CommunicationsService;

  // Should not throw - communication failures are non-blocking
  const result = await checkAttendanceThreshold(
    "tenant-1",
    "student-1",
    "section-1",
    defaultConfig,
    db,
    repo,
    failingService,
    systemActor,
  );

  assert.equal(result.alertFired, true);
  assert.equal(result.guardianEmailEnqueued, false); // Failed to enqueue
  assert.equal(suggestions.length, 1); // ShepherdAI signal still created
});

test("suggestion does not contain secret field names", async () => {
  const db = mockDatabase({ absenceCount: 5, totalMeetings: 20 });
  const { repo, suggestions } = mockShepherdRepo();
  const { service } = mockCommunicationsService();

  await checkAttendanceThreshold(
    "tenant-1",
    "student-1",
    "section-1",
    defaultConfig,
    db,
    repo,
    service,
    systemActor,
  );

  const suggestionJson = JSON.stringify(suggestions[0]);
  assert.doesNotMatch(suggestionJson, /accessToken/i);
  assert.doesNotMatch(suggestionJson, /credentialSecret/i);
  assert.doesNotMatch(suggestionJson, /rawProviderPayload/i);
  assert.doesNotMatch(suggestionJson, /api.?key/i);
});

// ================================================================
// computeAttendanceRateSignal tests (T3-04)
// ================================================================

import { computeAttendanceRateSignal } from "@/modules/attendance/threshold-evaluator";

function mockDatabaseForBatch(options: {
  students: Array<{ id: string; absenceCount: number; totalMeetings: number; enrollmentStatus?: string }>;
  existingSuggestions?: Array<{ studentId: string; suggestionId: string; status: string }>;
}) {
  const db: AttendanceThresholdDatabase = {
    async query(sql: string, values?: unknown[]) {
      if (sql.includes("distinct student_person_id")) {
        return {
          rows: options.students.map((s) => ({ student_person_id: s.id })),
        };
      }

      if (sql.includes("academy_student_profiles")) {
        const studentId = values?.[1] as string;
        const student = options.students.find((s) => s.id === studentId);
        if (student && student.enrollmentStatus) {
          return {
            rows: [{ enrollment_status: student.enrollmentStatus }],
          };
        }
        return {
          rows: [{ enrollment_status: "enrolled" }],
        };
      }

      if (sql.includes("academy_attendance_records")) {
        const studentId = values?.[1] as string;
        const student = options.students.find((s) => s.id === studentId);
        if (student) {
          return {
            rows: [
              {
                absence_count: student.absenceCount,
                total_meetings: student.totalMeetings,
              },
            ],
          };
        }
        return { rows: [] };
      }

      if (sql.includes("academy_course_sections")) {
        return {
          rows: [
            {
              section_id: "section-1",
              section_name: "Bible Study 101 - Fall 2026",
              course_name: "Introduction to Scripture",
              instructor_name: "Dr. Smith",
            },
          ],
        };
      }

      if (sql.includes("academy_people")) {
        const studentId = values?.[1] as string;
        return {
          rows: [
            {
              id: studentId,
              display_name: `Student ${studentId}`,
            },
          ],
        };
      }

      if (sql.includes("ai_suggestions")) {
        const studentId = values?.[1] as string;
        const existing = options.existingSuggestions?.find((e) => e.studentId === studentId);
        if (existing) {
          return {
            rows: [{ id: existing.suggestionId, status: existing.status }],
          };
        }
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  return db;
}

function mockShepherdRepoWithUpdates() {
  const suggestions: ShepherdAiSuggestion[] = [];
  const updates: Array<{ tenantId: string; suggestionId: string; status: string }> = [];

  const repo: ShepherdAiPostgresRepository = {
    async saveSuggestions(s) {
      suggestions.push(...s);
    },
    async updateSuggestionStatus(tenantId, suggestionId, status) {
      updates.push({ tenantId, suggestionId, status });
    },
  } as unknown as ShepherdAiPostgresRepository;

  return { repo, suggestions, updates };
}

test("computeAttendanceRateSignal: below threshold for all students - no signals created", async () => {
  const db = mockDatabaseForBatch({
    students: [
      { id: "student-1", absenceCount: 1, totalMeetings: 10 },
      { id: "student-2", absenceCount: 0, totalMeetings: 10 },
    ],
  });
  const { repo, suggestions } = mockShepherdRepoWithUpdates();

  await computeAttendanceRateSignal("tenant-1", "section-1", defaultConfig, db, repo);

  assert.equal(suggestions.length, 0);
});

test("computeAttendanceRateSignal: one student above warning - medium urgency signal", async () => {
  const db = mockDatabaseForBatch({
    students: [
      { id: "student-1", absenceCount: 1, totalMeetings: 10 }, // 10% - below
      { id: "student-2", absenceCount: 3, totalMeetings: 20 }, // 15% - warning
    ],
  });
  const { repo, suggestions } = mockShepherdRepoWithUpdates();

  await computeAttendanceRateSignal("tenant-1", "section-1", defaultConfig, db, repo);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].entityId, "student-2");
  assert.equal(suggestions[0].urgency, "medium");
  assert.match(suggestions[0].summary, /15%/);
});

test("computeAttendanceRateSignal: one student above alert - high urgency signal", async () => {
  const db = mockDatabaseForBatch({
    students: [
      { id: "student-1", absenceCount: 1, totalMeetings: 10 }, // 10% - below
      { id: "student-2", absenceCount: 5, totalMeetings: 20 }, // 25% - alert
    ],
  });
  const { repo, suggestions } = mockShepherdRepoWithUpdates();

  await computeAttendanceRateSignal("tenant-1", "section-1", defaultConfig, db, repo);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].entityId, "student-2");
  assert.equal(suggestions[0].urgency, "high");
  assert.match(suggestions[0].summary, /25%/);
});

test("computeAttendanceRateSignal: updates existing suggestion - not duplicates", async () => {
  const db = mockDatabaseForBatch({
    students: [{ id: "student-1", absenceCount: 3, totalMeetings: 20 }],
    existingSuggestions: [{ studentId: "student-1", suggestionId: "existing-1", status: "suggested" }],
  });
  const { repo, suggestions } = mockShepherdRepoWithUpdates();

  await computeAttendanceRateSignal("tenant-1", "section-1", defaultConfig, db, repo);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].id, "existing-1"); // Reuses existing ID
});

test("computeAttendanceRateSignal: student on leave - signal suppressed", async () => {
  const db = mockDatabaseForBatch({
    students: [
      { id: "student-1", absenceCount: 5, totalMeetings: 10, enrollmentStatus: "leave_of_absence" },
      { id: "student-2", absenceCount: 5, totalMeetings: 10, enrollmentStatus: "enrolled" },
    ],
  });
  const { repo, suggestions } = mockShepherdRepoWithUpdates();

  await computeAttendanceRateSignal("tenant-1", "section-1", defaultConfig, db, repo);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].entityId, "student-2"); // Only enrolled student gets signal
});

test("computeAttendanceRateSignal: rate drops below threshold - existing signal resolved", async () => {
  const db = mockDatabaseForBatch({
    students: [{ id: "student-1", absenceCount: 1, totalMeetings: 10 }], // 10% - below threshold
    existingSuggestions: [{ studentId: "student-1", suggestionId: "existing-1", status: "suggested" }],
  });
  const { repo, suggestions, updates } = mockShepherdRepoWithUpdates();

  await computeAttendanceRateSignal("tenant-1", "section-1", defaultConfig, db, repo);

  assert.equal(suggestions.length, 0); // No new suggestions
  assert.equal(updates.length, 1);
  assert.equal(updates[0].suggestionId, "existing-1");
  assert.equal(updates[0].status, "resolved");
});

test("computeAttendanceRateSignal: section with 1 meeting - signal fires with low confidence", async () => {
  const db = mockDatabaseForBatch({
    students: [{ id: "student-1", absenceCount: 1, totalMeetings: 1 }], // 100% - above alert
  });
  const { repo, suggestions } = mockShepherdRepoWithUpdates();

  await computeAttendanceRateSignal("tenant-1", "section-1", defaultConfig, db, repo);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].urgency, "high");
  assert.ok(suggestions[0].explanation.limitations.some((l) => l.includes("Low meeting count")));
  assert.equal(suggestions[0].confidenceScore, 0.6);
});
