import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidAttendanceStatus,
  isValidSessionType,
  validateAttendanceInput,
  ATTENDANCE_STATUSES,
  SESSION_TYPES,
} from "../types";

test("ATTENDANCE_STATUSES covers the four expected values", () => {
  assert.deepEqual(ATTENDANCE_STATUSES, ["present", "absent", "late", "excused"]);
});

test("SESSION_TYPES covers the five expected values", () => {
  assert.deepEqual(SESSION_TYPES, ["class", "lab", "chapel", "spiritual_formation", "other"]);
});

test("isValidAttendanceStatus accepts valid statuses", () => {
  for (const status of ATTENDANCE_STATUSES) {
    assert.equal(isValidAttendanceStatus(status), true);
  }
});

test("isValidAttendanceStatus rejects unknown values", () => {
  assert.equal(isValidAttendanceStatus("skipped"), false);
  assert.equal(isValidAttendanceStatus(""), false);
  assert.equal(isValidAttendanceStatus("PRESENT"), false);
});

test("isValidSessionType accepts valid session types", () => {
  for (const sessionType of SESSION_TYPES) {
    assert.equal(isValidSessionType(sessionType), true);
  }
});

test("isValidSessionType rejects unknown values", () => {
  assert.equal(isValidSessionType("assembly"), false);
  assert.equal(isValidSessionType(""), false);
  assert.equal(isValidSessionType("CLASS"), false);
});

test("validateAttendanceInput returns validated input for a complete record", () => {
  const input = {
    tenantId: "tenant-1",
    courseSectionId: "section-1",
    studentPersonId: "student-1",
    sessionDate: "2026-09-01",
    status: "present" as const,
    sessionType: "class" as const,
    recordedByPersonId: "faculty-1",
  };

  const result = validateAttendanceInput(input);

  assert.equal(result.tenantId, "tenant-1");
  assert.equal(result.status, "present");
  assert.equal(result.sessionType, "class");
  assert.equal(result.sessionDate, "2026-09-01");
});

test("validateAttendanceInput rejects missing tenantId", () => {
  assert.throws(
    () => validateAttendanceInput({ courseSectionId: "s1", studentPersonId: "p1", sessionDate: "2026-09-01", status: "present", sessionType: "class", recordedByPersonId: "f1" }),
    /tenantId is required/,
  );
});

test("validateAttendanceInput rejects invalid status", () => {
  assert.throws(
    () => validateAttendanceInput({ tenantId: "t1", courseSectionId: "s1", studentPersonId: "p1", sessionDate: "2026-09-01", status: "skipped" as never, sessionType: "class", recordedByPersonId: "f1" }),
    /status must be one of/,
  );
});

test("validateAttendanceInput rejects invalid session type", () => {
  assert.throws(
    () => validateAttendanceInput({ tenantId: "t1", courseSectionId: "s1", studentPersonId: "p1", sessionDate: "2026-09-01", status: "present", sessionType: "assembly" as never, recordedByPersonId: "f1" }),
    /sessionType must be one of/,
  );
});

test("validateAttendanceInput rejects malformed session date", () => {
  assert.throws(
    () => validateAttendanceInput({ tenantId: "t1", courseSectionId: "s1", studentPersonId: "p1", sessionDate: "September 1", status: "present", sessionType: "class", recordedByPersonId: "f1" }),
    /YYYY-MM-DD/,
  );
});

test("cross-tenant rejection: validateAttendanceInput does not accept empty tenantId", () => {
  assert.throws(
    () => validateAttendanceInput({ tenantId: "", courseSectionId: "s1", studentPersonId: "p1", sessionDate: "2026-09-01", status: "present", sessionType: "class", recordedByPersonId: "f1" }),
    /tenantId is required/,
  );
});
