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
    sessionType: input.sessionType,
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
  const service = new AttendanceService({ repository: repo });

  const result = await service.recordAttendance(facultyActor, {
    courseSectionId: "section-1",
    studentPersonId: "student-1",
    sessionDate: "2026-09-01",
    status: "present",
    sessionType: "class",
  });

  assert.equal(result.status, "present");
  assert.equal(result.sessionType, "class");
  assert.equal(upserts[0].tenantId, "tenant-1");
  assert.equal(upserts[0].recordedByPersonId, "faculty-1");
  assert.equal(upserts[0].sessionType, "class");
});

test("rejects student attempts before repository writes", async () => {
  const { repo, upserts } = repository();
  const service = new AttendanceService({ repository: repo });

  await assert.rejects(
    () =>
      service.recordAttendance(studentActor, {
        courseSectionId: "section-1",
        studentPersonId: "student-1",
        sessionDate: "2026-09-01",
        status: "present",
        sessionType: "class",
      }),
    /Forbidden attendance write access/i,
  );

  assert.equal(upserts.length, 0);
});

test("rejects faculty attendance outside owned sections", async () => {
  const { repo, upserts } = repository({ canRecord: false });
  const service = new AttendanceService({ repository: repo });

  await assert.rejects(
    () =>
      service.recordAttendance(facultyActor, {
        courseSectionId: "section-2",
        studentPersonId: "student-1",
        sessionDate: "2026-09-01",
        status: "present",
        sessionType: "class",
      }),
    /Faculty can record attendance only for assigned sections/i,
  );

  assert.equal(upserts.length, 0);
});

test("rejects attendance for students without active section registration", async () => {
  const { repo, upserts } = repository({ studentRegistered: false });
  const service = new AttendanceService({ repository: repo });

  await assert.rejects(
    () =>
      service.recordAttendance(facultyActor, {
        courseSectionId: "section-1",
        studentPersonId: "student-2",
        sessionDate: "2026-09-01",
        status: "absent",
        sessionType: "class",
      }),
    /Student must have an active section registration/i,
  );

  assert.equal(upserts.length, 0);
});

test("legacy constructor signature still supported for backwards compatibility", async () => {
  const { repo, upserts } = repository();
  const service = new AttendanceService(repo);

  const result = await service.recordAttendance(facultyActor, {
    courseSectionId: "section-1",
    studentPersonId: "student-1",
    sessionDate: "2026-09-01",
    status: "present",
    sessionType: "lab",
  });

  assert.equal(result.status, "present");
  assert.equal(result.sessionType, "lab");
  assert.equal(upserts.length, 1);
});

// Side effects (threshold signal, guardian notification) used to run unawaited on the request's
// transaction. When one failed, Postgres aborted the transaction and the request's COMMIT silently
// rolled back the attendance record itself (2026-10-08). They now run awaited, each in a savepoint.
function sideEffectDependencies(options: { failQueries: boolean }) {
  const queries: string[] = [];
  const thresholdDatabase = {
    async query(sql: string) {
      const statement = sql.trim().replace(/\s+/g, " ");
      queries.push(statement);
      if (/^(savepoint|release savepoint|rollback to savepoint)/.test(statement)) return { rows: [] };
      if (options.failQueries) throw new Error('invalid input syntax for type uuid: "section-1"');
      return { rows: [] };
    },
  };
  return {
    queries,
    dependencies: {
      thresholdDatabase,
      thresholdConfig: { warningPct: 15, alertPct: 25, excusedCounts: false },
      shepherdRepo: { async saveSuggestions() {}, async updateSuggestionStatus() {} } as never,
      communicationsService: { async createCommunication() { return {}; } } as never,
    },
  };
}

test("a failing side effect is rolled back to its savepoint and the attendance record is kept", async () => {
  const { repo, upserts } = repository();
  const { queries, dependencies } = sideEffectDependencies({ failQueries: true });
  const service = new AttendanceService({ repository: repo, ...dependencies });

  const result = await service.recordAttendance(facultyActor, {
    courseSectionId: "section-1",
    studentPersonId: "student-1",
    sessionDate: "2026-09-01",
    status: "absent",
    sessionType: "class",
  });

  assert.equal(result.status, "absent");
  assert.equal(upserts.length, 1);
  for (const savepoint of ["attendance_threshold_check", "attendance_guardian_check"]) {
    assert.ok(queries.includes(`savepoint ${savepoint}`), `opens ${savepoint}`);
    assert.ok(queries.includes(`rollback to savepoint ${savepoint}`), `rolls back only ${savepoint}`);
    assert.ok(queries.includes(`release savepoint ${savepoint}`), `releases ${savepoint}`);
  }
  assert.equal(queries.at(-1), "release savepoint attendance_guardian_check",
    "every side-effect query finishes before recordAttendance returns");
});

test("successful side effects release their savepoints without rolling back", async () => {
  const { repo } = repository();
  const { queries, dependencies } = sideEffectDependencies({ failQueries: false });
  const service = new AttendanceService({ repository: repo, ...dependencies });

  await service.recordAttendance(facultyActor, {
    courseSectionId: "section-1",
    studentPersonId: "student-1",
    sessionDate: "2026-09-01",
    status: "present",
    sessionType: "class",
  });

  assert.ok(queries.includes("release savepoint attendance_threshold_check"));
  assert.ok(!queries.some((query) => query.startsWith("rollback to savepoint")));
});

test("the service no longer fires side effects without awaiting them", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/modules/attendance/service.ts", "utf8");
  assert.doesNotMatch(source, /\)\.catch\(\(\) => \{/, "no fire-and-forget .catch on side effects");
  assert.match(source, /await runIsolatedSideEffect\(database, "attendance_threshold_check"/);
  assert.match(source, /await runIsolatedSideEffect\(database, "attendance_guardian_check"/);
});
