import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { STUDENT_RECORD_ROLES } from "@/modules/people/access-policy";

// Regression: GET /api/academy/students and /api/academy/students/[id] returned the whole
// student roster (names, emails, records) to any signed-in user, a student included.

test("the student roster routes require a staff student-record role before loading data", async () => {
  for (const file of ["src/app/api/academy/students/route.ts", "src/app/api/academy/students/[id]/route.ts"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /requireActor\(actor, STUDENT_RECORD_ROLES\);[\s\S]*loadDataset/, file);
  }
});

test("students, guardians, and non-records staff are not in the student-record roles", () => {
  for (const role of ["student", "guardian", "applicant", "faculty", "teacher", "finance", "alumni_relations"] as const) {
    assert.equal(STUDENT_RECORD_ROLES.includes(role), false, role);
  }
});
