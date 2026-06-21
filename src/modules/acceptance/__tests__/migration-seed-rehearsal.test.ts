import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  assert.match(source, /academy_institution_profiles/);
  assert.match(source, /academy_student_profiles/);
  assert.match(source, /academy_attendance_records/);
  assert.match(source, /academy_transcript_issuances/);
  assert.match(source, /academy-data\/server-dataset/);
  assert.match(source, /academy-data\/mock-data/);
});
