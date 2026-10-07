import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sectionsForActor } from "@/lib/faculty-section-scope";
import type { AcademyActor } from "@/modules/academy-auth/policy";

const sections = [
  { id: "own", instructorFacultyId: "person-faculty-1", assistantInstructorIds: [] },
  { id: "assisting", instructorFacultyId: "person-faculty-2", assistantInstructorIds: ["person-faculty-1"] },
  { id: "other", instructorFacultyId: "person-faculty-2", assistantInstructorIds: [] },
  { id: "unassigned" },
];

function actor(roles: AcademyActor["roles"], userId = "person-faculty-1"): AcademyActor {
  return { userId, tenantId: "tenant-a", roles };
}

test("a faculty member sees the sections they teach as primary or assistant instructor", () => {
  assert.deepEqual(sectionsForActor(sections, actor(["faculty"])).map((s) => s.id), ["own", "assisting"]);
});

test("a faculty member with no assignments sees no sections", () => {
  assert.deepEqual(sectionsForActor(sections, actor(["teacher"], "person-faculty-9")), []);
});

test("oversight roles that can record attendance anywhere see every section", () => {
  for (const role of ["institution_admin", "dean", "registrar", "academic_admin"] as const) {
    assert.equal(sectionsForActor(sections, actor([role], "person-admin")).length, sections.length, role);
  }
});

test("a teaching role combined with an oversight role keeps the full list", () => {
  assert.equal(sectionsForActor(sections, actor(["faculty", "registrar"])).length, sections.length);
});

test("faculty home and attendance picker both scope sections to the actor", () => {
  for (const file of ["src/app/faculty/page.tsx", "src/app/faculty/attendance/page.tsx"]) {
    assert.match(readFileSync(file, "utf8"), /sectionsForActor\((data\.sections|allSections), actor\)/, file);
  }
});
