import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidAttendanceStatus,
  validateAttendanceInput,
  ATTENDANCE_STATUSES,
} from "../types";

test("ATTENDANCE_STATUSES covers the four expected values", () => {
  assert.deepEqual(ATTENDANCE_STATUSES, ["present", "absent", "late", "excused"]);
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

test("validateAttendanceInput returns validated input for a complete record", () => {
  const input = {
    tenantId: "tenant-1",
    courseSectionId: "section-1",
    studentPersonId: "student-1",
    sessionDate: "2026-09-01",
    status: "present" as const,
    recordedByPersonId: "faculty-1",
  };

  const result = validateAttendanceInput(input);

  assert.equal(result.tenantId, "tenant-1");
  assert.equal(result.status, "present");
  assert.equal(result.sessionDate, "2026-09-01");
});

test("validateAttendanceInput rejects missing tenantId", () => {
  assert.throws(
    () => validateAttendanceInput({ courseSectionId: "s1", studentPersonId: "p1", sessionDate: "2026-09-01", status: "present", recordedByPersonId: "f1" }),
    /tenantId is required/,
  );
});

test("validateAttendanceInput rejects invalid status", () => {
  assert.throws(
    () => validateAttendanceInput({ tenantId: "t1", courseSectionId: "s1", studentPersonId: "p1", sessionDate: "2026-09-01", status: "skipped" as never, recordedByPersonId: "f1" }),
    /status must be one of/,
  );
});

test("validateAttendanceInput rejects malformed session date", () => {
  assert.throws(
    () => validateAttendanceInput({ tenantId: "t1", courseSectionId: "s1", studentPersonId: "p1", sessionDate: "September 1", status: "present", recordedByPersonId: "f1" }),
    /YYYY-MM-DD/,
  );
});

test("cross-tenant rejection: validateAttendanceInput does not accept empty tenantId", () => {
  assert.throws(
    () => validateAttendanceInput({ tenantId: "", courseSectionId: "s1", studentPersonId: "p1", sessionDate: "2026-09-01", status: "present", recordedByPersonId: "f1" }),
    /tenantId is required/,
  );
});
