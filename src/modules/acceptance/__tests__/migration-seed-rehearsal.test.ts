import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260621185128_add_finance_rls_role.sql",
);

test("finance role RLS migration covers billing, aid, and communications policies", async () => {
  const sql = await readFile(migrationPath, "utf8");

  for (const table of [
    "academy_student_accounts",
    "academy_billing_ledger_entries",
    "academy_payment_intents",
    "academy_aid_packages",
    "academy_aid_awards",
    "academy_aid_disbursements",
    "academy_aid_holds",
    "academy_communication_messages",
    "academy_communication_preferences",
    "academy_communication_audit_events",
  ]) {
    assert.match(sql, new RegExp(`on public\\.${table}`));
  }

  assert.match(sql, /array\['institution_admin', 'registrar', 'academic_admin', 'dean', 'finance'\]/);
  assert.match(sql, /array\['institution_admin', 'registrar', 'academic_admin', 'dean', 'admissions', 'finance'\]/);
});

test("migration seed rehearsal verifier checks tracking, seed counts, and runtime source boundary", async () => {
  const source = await readFile(
    path.join(process.cwd(), "scripts/verify-migration-seed-rehearsal.ts"),
    "utf8",
  );

  assert.match(source, /schema_migrations/);
  assert.match(source, /supabase_migrations\.schema_migrations/);
  assert.match(source, /academy_institution_profiles/);
  assert.match(source, /academy_student_profiles/);
  assert.match(source, /academy_attendance_records/);
  assert.match(source, /academy_transcript_issuances/);
  assert.match(source, /academy-data\/server-dataset/);
  assert.match(source, /academy-data\/mock-data/);
});

test("multi-institution seed relaxes legacy admissions-chain columns before direct demo enrollments", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260624060000_seed_demo_multi_institution_showcase.sql"),
    "utf8",
  );

  assert.match(sql, /alter table public\.academy_program_enrollments[\s\S]*alter column program_id drop not null/);
  assert.match(sql, /alter table public\.academy_program_enrollments[\s\S]*alter column source_application_id drop not null/);
  assert.match(sql, /alter table public\.academy_period_registrations[\s\S]*alter column program_enrollment_id drop not null/);
  assert.match(sql, /alter table public\.academy_period_registrations[\s\S]*alter column source_application_id drop not null/);
  assert.match(sql, /alter table public\.academy_course_section_registrations[\s\S]*alter column program_enrollment_id drop not null/);
  assert.match(sql, /alter table public\.academy_course_section_registrations[\s\S]*alter column source_application_id drop not null/);
});

test("multi-campus migration uses Academy text tenants and existing staff profile table", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260624130000_multi_campus.sql"),
    "utf8",
  );

  assert.match(sql, /tenant_id\s+text not null/);
  assert.match(sql, /alter table (public\.)?academy_staff_profiles/);
  assert.match(sql, /on (public\.)?academy_staff_profiles \(campus_id\)/);
  assert.match(sql, /tenant_id = current_setting\('app\.academy_tenant_id', true\)/);
  assert.doesNotMatch(sql, /academy_staff_members/);
  assert.doesNotMatch(sql, /::uuid/);
});

test("supabase migrations use unique version prefixes", async () => {
  const migrationNames = (await readdir(path.join(process.cwd(), "supabase/migrations")))
    .filter((name) => name.endsWith(".sql"));
  const versions = new Map<string, string[]>();

  for (const name of migrationNames) {
    const version = name.split("_", 1)[0];
    versions.set(version, [...(versions.get(version) ?? []), name]);
  }

  const duplicates = [...versions.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([version, names]) => `${version}: ${names.join(", ")}`);

  assert.deepEqual(duplicates, []);
});

test("application document migrations use Academy tenant and role helpers", async () => {
  const documentTypes = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260625030000_academy_document_types.sql"),
    "utf8",
  );
  const applicationDocuments = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260625040000_academy_application_documents.sql"),
    "utf8",
  );

  for (const sql of [documentTypes, applicationDocuments]) {
    assert.match(sql, /tenant_id text not null/);
    assert.match(sql, /academy_private\.academy_has_active_role/);
    assert.doesNotMatch(sql, /academy_staff_roles/);
    assert.doesNotMatch(sql, /tenant_id uuid/);
  }
});

test("assignment grading migration converts fractional weights during type change", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260625170000_assignments_per_assignment_grading.sql"),
    "utf8",
  );

  assert.match(sql, /alter column weight type integer using[\s\S]*case[\s\S]*weight <= 1\.0[\s\S]*weight \* 100/);
  assert.doesNotMatch(sql, /update public\.academy_gradebook_assignments\s+set weight = weight \* 100/i);
});

test("scheduled reports migration uses existing tenant and role helpers", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260626010000_scheduled_reports.sql"),
    "utf8",
  );

  assert.match(sql, /references public\.academy_institution_profiles\(tenant_id\)/);
  assert.match(sql, /academy_private\.academy_has_active_role/);
  assert.doesNotMatch(sql, /academy_tenants/);
  assert.doesNotMatch(sql, /academy_current_role/);
});

test("institution profile grant exposes RLS-guarded dashboard reads to authenticated users", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260629165721_grant_authenticated_institution_profile_read.sql"),
    "utf8",
  );

  assert.match(sql, /grant select on public\.academy_institution_profiles to authenticated/i);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all)/i);
});

test("institution mode-pack migration normalizes mixed into concrete selected modes", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260629212248_normalize_institution_mode_packs.sql"),
    "utf8",
  );

  assert.match(sql, /profile\.primary_mode = 'mixed'/);
  assert.match(sql, /where mode_value <> 'mixed'/);
  assert.match(sql, /profile\.supported_modes \? 'mixed'/);
  assert.match(sql, /normalized\.concrete_supported_modes ->> 0/);
  assert.match(sql, /updated_at = profile\.updated_at/);
});

test("institution demo seeds do not store mixed as a selected institution mode", async () => {
  const seedFiles = [
    "20260616085000_seed_demo_institution_foundation.sql",
    "20260624060000_seed_demo_multi_institution_showcase.sql",
  ];

  for (const file of seedFiles) {
    const sql = await readFile(path.join(process.cwd(), "supabase/migrations", file), "utf8");
    assert.doesNotMatch(sql, /supported_modes\s*(?:=|,)[\s\S]{0,120}\[[^\]]*"mixed"/);
    assert.doesNotMatch(sql, /primary_mode\s*(?:=|,)\s*'mixed'/);
  }
});
