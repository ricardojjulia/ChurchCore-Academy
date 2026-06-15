import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function loadMigration() {
  const migrationDirectory = path.join(process.cwd(), "supabase", "migrations");
  const migration = fs
    .readdirSync(migrationDirectory)
    .find((file) =>
      file.endsWith("_accepted_application_enrollment_conversion.sql"),
    );

  assert.ok(migration, "enrollment conversion migration should exist");
  return fs.readFileSync(path.join(migrationDirectory, migration), "utf8");
}

test("migration creates conversion records and immutable application metadata", () => {
  const sql = loadMigration();

  assert.match(sql, /alter table public\.academy_admission_applications/i);
  assert.match(sql, /converted_at timestamptz/i);
  assert.match(sql, /converted_by_person_id text/i);
  assert.match(sql, /student_profile_id text/i);
  assert.match(sql, /program_enrollment_id uuid/i);
  assert.match(sql, /period_registration_id uuid/i);
  assert.match(sql, /create table.*public\.academy_program_enrollments/i);
  assert.match(sql, /create table.*public\.academy_period_registrations/i);
  assert.match(
    sql,
    /create table.*public\.academy_enrollment_conversion_events/i,
  );
  assert.match(
    sql,
    /create table.*public\.academy_student_number_sequences/i,
  );
  assert.match(sql, /conversion events are immutable/i);
  assert.match(sql, /conversion metadata is immutable/i);
});

test("migration applies tenant-aware constraints and forced RLS", () => {
  const sql = loadMigration();

  for (const table of [
    "academy_program_enrollments",
    "academy_period_registrations",
    "academy_enrollment_conversion_events",
    "academy_student_number_sequences",
  ]) {
    assert.match(
      sql,
      new RegExp(
        `alter table public\\.${table} enable row level security`,
        "i",
      ),
    );
    assert.match(
      sql,
      new RegExp(
        `alter table public\\.${table} force row level security`,
        "i",
      ),
    );
  }

  assert.match(
    sql,
    /foreign key \(tenant_id, application_id\)[\s\S]*academy_admission_applications \(tenant_id, id\)/i,
  );
  assert.match(
    sql,
    /foreign key \(tenant_id, student_profile_id\)[\s\S]*academy_student_profiles \(tenant_id, id\)/i,
  );
  assert.match(
    sql,
    /array\['institution_admin', 'registrar', 'admissions'\]/i,
  );
  assert.doesNotMatch(
    sql,
    /array\['institution_admin', 'dean', 'registrar', 'admissions'\]/i,
  );
  assert.match(
    sql,
    /revoke all on public\.academy_enrollment_conversion_events from anon/i,
  );
  assert.match(
    sql,
    /revoke update, delete on public\.academy_enrollment_conversion_events from authenticated/i,
  );
  assert.match(
    sql,
    /create policy academy_audit_admissions_own_read[\s\S]*actor_person_id = academy_private\.academy_current_person_id\(\)/i,
  );
});
