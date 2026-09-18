import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";

const migrationName = "20260917020000_final_grade_submission_rls.sql";
const fixesMigrationName = "20260917030000_final_grade_submission_fixes.sql";
const gradebookPhase1MigrationName = "20260616002351_gradebook_phase1.sql";

async function readMigration(name: string = migrationName) {
  return readFile(join(process.cwd(), "supabase/migrations", name), "utf8");
}

test("local migration discovery includes the final-grade submission RLS fix after gradebook phase 1", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map((migration) => migration.name);

  const previousIndex = names.indexOf(gradebookPhase1MigrationName);
  const migrationIndex = names.indexOf(migrationName);

  assert.notEqual(previousIndex, -1);
  assert.notEqual(migrationIndex, -1);
  assert.ok(migrationIndex > previousIndex);
});

test("final-grade submission RLS fix widens academy_gradebook_course_summaries writes to faculty roles", async () => {
  const sql = await readMigration();

  // submitDraftFinalGrade's own application-layer check allows faculty/teacher/professor
  // (isInstructor()), matching ADR-0054's "faculty posts the final grade" design — the RLS
  // policy must allow the same roles, or every faculty call passes the app check and then fails
  // at the database layer.
  assert.match(sql, /drop policy if exists "academy_gradebook_summaries_staff_write"/i);
  assert.match(sql, /create policy "academy_gradebook_summaries_staff_write"/i);
  const summariesPolicy = sql.match(
    /create policy "academy_gradebook_summaries_staff_write"[\s\S]*?;/i,
  );
  assert.ok(summariesPolicy, "expected the academy_gradebook_summaries_staff_write policy body");
  for (const role of ["institution_admin", "dean", "registrar", "academic_admin", "faculty", "teacher", "professor"]) {
    assert.match(summariesPolicy![0], new RegExp(`'${role}'`, "i"));
  }
});

test("final-grade submission RLS fix re-asserts the role check inside WITH CHECK, not just USING", async () => {
  const sql = await readMigration();

  // USING alone does not gate INSERT — only WITH CHECK is evaluated for a new row — so a policy
  // whose WITH CHECK only tests tenant_id (as the first version of this migration did) lets ANY
  // authenticated user in the tenant, including a student, insert a gradebook course summary.
  // Found in PR review before merge; the sibling academy_gradebook_records_staff_write policy
  // already gets this right.
  const summariesPolicy = sql.match(
    /create policy "academy_gradebook_summaries_staff_write"[\s\S]*?;/i,
  );
  assert.ok(summariesPolicy, "expected the academy_gradebook_summaries_staff_write policy body");
  const withCheckClause = summariesPolicy![0].match(/with check\s*\(([\s\S]*)\)\s*;/i);
  assert.ok(withCheckClause, "expected a with check clause");
  for (const role of ["institution_admin", "dean", "registrar", "academic_admin", "faculty", "teacher", "professor"]) {
    assert.match(withCheckClause![1], new RegExp(`'${role}'`, "i"));
  }
});

test("final-grade submission RLS fix adds the missing UPDATE policy on academy_course_section_registrations", async () => {
  const sql = await readMigration();

  // academy_course_section_registrations previously had SELECT and INSERT policies only —
  // forced RLS with no UPDATE policy denies every UPDATE unconditionally, so the already-shipped
  // PATCH /api/academy/registrations/[id] status-change endpoint, and submitDraftFinalGrade's own
  // new "mark registration completed" step, could never have updated a row for any real user.
  assert.match(sql, /create policy "academy_section_registration_update"/i);
  assert.match(sql, /for update/i);
  const updatePolicy = sql.match(/create policy "academy_section_registration_update"[\s\S]*?;/i);
  assert.ok(updatePolicy, "expected the academy_section_registration_update policy body");
  for (const role of ["institution_admin", "dean", "registrar", "academic_admin", "faculty", "teacher", "professor"]) {
    assert.match(updatePolicy![0], new RegExp(`'${role}'`, "i"));
  }
});

test("local migration discovery includes the final-grade submission follow-up fixes after the RLS fix", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map((migration) => migration.name);

  const previousIndex = names.indexOf(migrationName);
  const fixesIndex = names.indexOf(fixesMigrationName);

  assert.notEqual(previousIndex, -1);
  assert.notEqual(fixesIndex, -1);
  assert.ok(fixesIndex > previousIndex);
});

test("final-grade submission follow-up fix scopes the gradebook course summary uniqueness to course_id", async () => {
  const sql = await readMigration(fixesMigrationName);

  // enrollment_id is the student's PROGRAM enrollment, not course-scoped — a student can have
  // multiple course_section registrations under the same program enrollment (confirmed against
  // real local data: 2 program enrollments each span 2 course sections). A unique constraint on
  // (tenant_id, enrollment_id) alone let a second course's final-grade submission silently
  // overwrite the first course's summary row.
  assert.match(sql, /drop constraint if exists academy_gradebook_course_summaries_tenant_id_enrollment_id_key/i);
  assert.match(sql, /add constraint academy_gradebook_course_summaries_tenant_id_enrollment_course_key/i);
  assert.match(sql, /unique \(tenant_id, enrollment_id, course_id\)/i);
});

test("final-grade submission follow-up fix widens the registration SELECT policy to instructor roles", async () => {
  const sql = await readMigration(fixesMigrationName);

  // getSectionFinalGradeStatus and submitDraftFinalGrade's own registration lookup both query
  // academy_course_section_registrations as the faculty actor. Under forced RLS, a query that
  // fails the SELECT policy doesn't error — it silently returns zero rows — so a faculty-only
  // (non-admin-tier) account would see an empty roster with no visible failure at all.
  assert.match(sql, /drop policy if exists "academy_section_registration_read"/i);
  assert.match(sql, /create policy "academy_section_registration_read"/i);
  const readPolicy = sql.match(/create policy "academy_section_registration_read"[\s\S]*?;/i);
  assert.ok(readPolicy, "expected the academy_section_registration_read policy body");
  for (const role of ["faculty", "teacher", "professor"]) {
    assert.match(readPolicy![0], new RegExp(`'${role}'`, "i"));
  }
  // The student-self and admin-tier read paths from the original policy must still be present —
  // this widens the policy, it doesn't replace who could already read it.
  assert.match(readPolicy![0], /academy_can_read_student/i);
  for (const role of ["institution_admin", "dean", "registrar", "academic_admin", "admissions"]) {
    assert.match(readPolicy![0], new RegExp(`'${role}'`, "i"));
  }
});
