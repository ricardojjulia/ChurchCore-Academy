import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";

const migrationName = "20260917020000_final_grade_submission_rls.sql";
const gradebookPhase1MigrationName = "20260616002351_gradebook_phase1.sql";

async function readMigration() {
  return readFile(join(process.cwd(), "supabase/migrations", migrationName), "utf8");
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
