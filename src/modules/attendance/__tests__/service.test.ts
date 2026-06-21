import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AttendanceService } from "@/modules/attendance/service";
import type {
  AttendanceRepository,
  AttendanceRecord,
  RecordAttendanceInput,
} from "@/modules/attendance/types";

const facultyActor: AcademyActor = {
  tenantId: "tenant-1",
  userId: "faculty-1",
  roles: ["faculty"],
};

const studentActor: AcademyActor = {
  tenantId: "tenant-1",
  userId: "student-1",
  roles: ["student"],
};

function attendanceRecord(
  input: RecordAttendanceInput,
  overrides: Partial<AttendanceRecord> = {},
): AttendanceRecord {
  return {
    id: "attendance-1",
    tenantId: input.tenantId,
    courseSectionId: input.courseSectionId,
    studentPersonId: input.studentPersonId,
    sessionDate: input.sessionDate,
    status: input.status,
    recordedAt: "2026-09-01T14:00:00.000Z",
    recordedByPersonId: input.recordedByPersonId,
    note: input.note,
    ...overrides,
  };
}

function repository(options: {
  canRecord?: boolean;
  studentRegistered?: boolean;
} = {}) {
  const upserts: RecordAttendanceInput[] = [];
  const repo: AttendanceRepository = {
    async upsert(input) {
      upserts.push(input);
      return attendanceRecord(input);
    },
    async listBySection() {
      return [];
    },
    async listByStudent() {
      return [];
    },
    async canRecordSectionAttendance() {
      return options.canRecord ?? true;
    },
    async isStudentActivelyRegistered() {
      return options.studentRegistered ?? true;
    },
  };

  return { repo, upserts };
}

test("records attendance when faculty owns the section and student is actively registered", async () => {
  const { repo, upserts } = repository();
  const service = new AttendanceService(repo);

  const result = await service.recordAttendance(facultyActor, {
    courseSectionId: "section-1",
    studentPersonId: "student-1",
    sessionDate: "2026-09-01",
    status: "present",
  });

  assert.equal(result.status, "present");
  assert.equal(upserts[0].tenantId, "tenant-1");
  assert.equal(upserts[0].recordedByPersonId, "faculty-1");
});

test("rejects student attempts before repository writes", async () => {
  const { repo, upserts } = repository();
  const service = new AttendanceService(repo);

  await assert.rejects(
    () =>
      service.recordAttendance(studentActor, {
        courseSectionId: "section-1",
        studentPersonId: "student-1",
        sessionDate: "2026-09-01",
        status: "present",
      }),
    /Forbidden attendance write access/i,
  );

  assert.equal(upserts.length, 0);
});

test("rejects faculty attendance outside owned sections", async () => {
  const { repo, upserts } = repository({ canRecord: false });
  const service = new AttendanceService(repo);

  await assert.rejects(
    () =>
      service.recordAttendance(facultyActor, {
        courseSectionId: "section-2",
        studentPersonId: "student-1",
        sessionDate: "2026-09-01",
        status: "present",
      }),
    /Faculty can record attendance only for assigned sections/i,
  );

  assert.equal(upserts.length, 0);
});

test("rejects attendance for students without active section registration", async () => {
  const { repo, upserts } = repository({ studentRegistered: false });
  const service = new AttendanceService(repo);

  await assert.rejects(
    () =>
      service.recordAttendance(facultyActor, {
        courseSectionId: "section-1",
        studentPersonId: "student-2",
        sessionDate: "2026-09-01",
        status: "absent",
      }),
    /Student must have an active section registration/i,
  );

  assert.equal(upserts.length, 0);
});
