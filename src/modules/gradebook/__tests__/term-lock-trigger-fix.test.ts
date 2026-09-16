import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";

const migrationName = "20260916010000_fix_gradebook_term_lock_trigger.sql";
const originalTriggerMigrationName = "20260626180000_add_term_lock_triggers.sql";
const periodRelationsMigrationName = "20260627000000_make_period_relations_mandatory.sql";

async function readMigration() {
  return readFile(join(process.cwd(), "supabase/migrations", migrationName), "utf8");
}

test("local migration discovery includes the gradebook term-lock trigger fix after period relations mandatory", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map((migration) => migration.name);

  const previousIndex = names.indexOf(periodRelationsMigrationName);
  const migrationIndex = names.indexOf(migrationName);

  assert.notEqual(previousIndex, -1);
  assert.notEqual(migrationIndex, -1);
  assert.ok(migrationIndex > previousIndex);
});

test("term-lock trigger fix replaces the shared function rather than editing a committed migration", async () => {
  const sql = await readMigration();
  const originalTrigger = await readFile(
    join(process.cwd(), "supabase/migrations", originalTriggerMigrationName),
    "utf8",
  );
  const periodRelations = await readFile(
    join(process.cwd(), "supabase/migrations", periodRelationsMigrationName),
    "utf8",
  );

  assert.match(sql, /create or replace function check_academic_period_is_not_completed\(\)/i);
  assert.match(originalTrigger, /create or replace function check_academic_period_is_not_completed\(\)/i);
  assert.match(periodRelations, /create or replace function check_academic_period_is_not_completed\(\)/i);
});

test("term-lock trigger fix resolves the gradebook branch through the assignment's section instead of a nonexistent column", async () => {
  const sql = await readMigration();

  const gradebookBranch = sql.match(
    /elsif tg_table_name = 'academy_gradebook_records' then([\s\S]*?)elsif/i,
  );
  assert.ok(gradebookBranch, "expected an academy_gradebook_records branch in the trigger function");

  assert.doesNotMatch(gradebookBranch![1], /new\.course_section_id/i);
  assert.match(gradebookBranch![1], /from academy_gradebook_assignments/i);
  assert.match(gradebookBranch![1], /where ga\.id = new\.assignment_id/i);
});

test("term-lock trigger fix keeps period_id typed as TEXT, matching academy_academic_periods.id", async () => {
  const sql = await readMigration();

  assert.match(sql, /period_id\s+text\s*;/i);
  assert.doesNotMatch(sql, /period_id\s+uuid\s*;/i);
});

test("term-lock trigger fix preserves the registrations, billing, and payment branches added by later migrations", async () => {
  const sql = await readMigration();

  assert.match(sql, /tg_table_name = 'academy_course_section_registrations'/i);
  assert.match(sql, /tg_table_name = 'academy_billing_ledger_entries'/i);
  assert.match(sql, /tg_table_name = 'academy_payment_intents'/i);
  assert.match(sql, /period_id\s*:=\s*new\.academic_period_id/i);
  assert.match(sql, /if period_id is not null then/i);
});
