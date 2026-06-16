import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";

const migrationName = "20260616002351_gradebook_phase1.sql";

async function readMigration() {
  return readFile(join(process.cwd(), "supabase/migrations", migrationName), "utf8");
}

test("local migration discovery includes gradebook phase 1 after platform admin seed", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map((migration) => migration.name);

  const previousIndex = names.indexOf("20260615100000_seed_platform_admin_account.sql");
  const migrationIndex = names.indexOf(migrationName);

  assert.notEqual(previousIndex, -1);
  assert.notEqual(migrationIndex, -1);
  assert.ok(migrationIndex > previousIndex);
});

test("gradebook phase 1 migration creates repo-native ADR-2025-009 tables", async () => {
  const sql = await readMigration();

  for (const tableName of [
    "academy_gradebook_scales",
    "academy_gradebook_scale_entries",
    "academy_gradebook_assignments",
    "academy_gradebook_submissions",
    "academy_gradebook_records",
    "academy_gradebook_course_summaries",
    "academy_gradebook_override_audit",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${tableName}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${tableName} enable row level security`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${tableName} force row level security`, "i"));
  }
});

test("gradebook phase 1 preserves sensitivity and phase boundaries", async () => {
  const sql = await readMigration();

  assert.match(sql, /academy_gradebook_records[\s\S]*sensitivity_tier text not null default 'standard'/i);
  assert.match(sql, /academy_gradebook_course_summaries[\s\S]*sensitivity_tier text not null default 'standard'/i);
  assert.match(sql, /academy_gradebook_records[\s\S]*ai_suggested_points numeric/i);
  assert.match(sql, /academy_gradebook_records[\s\S]*ai_accepted boolean/i);
  assert.doesNotMatch(sql, /ai_narrative_id uuid/i);
  assert.doesNotMatch(sql, /generated always as[\s\S]*is_late/i);
  assert.match(sql, /is_late is computed at query time/i);
  assert.doesNotMatch(sql, /create table if not exists public\.ai_learner_scores/i);
  assert.doesNotMatch(sql, /create table if not exists public\.ai_progress_narratives/i);
});

test("gradebook phase 1 migration enforces append-only overrides and pastoral audit", async () => {
  const sql = await readMigration();

  assert.match(sql, /create or replace function public\.academy_reject_gradebook_override_audit_mutation/i);
  assert.match(sql, /before update or delete on public\.academy_gradebook_override_audit/i);
  assert.match(sql, /academy_gradebook_override_audit is append-only/i);
  assert.match(sql, /create or replace function academy_private\.academy_audit_pastoral_gradebook_write/i);
  assert.match(sql, /after insert or update on public\.academy_gradebook_records/i);
  assert.match(sql, /after insert or update on public\.academy_gradebook_course_summaries/i);
  assert.match(sql, /insert into public\.academy_audit_events/i);
});

test("gradebook phase 1 migration includes service-role warning and explicit grants", async () => {
  const sql = await readMigration();

  assert.match(sql, /service_role bypasses all RLS policies below/i);
  assert.match(sql, /never expose the service_role key client-side/i);
  assert.match(sql, /revoke all on public\.academy_gradebook_records from anon/i);
  assert.match(sql, /grant select, insert, update on public\.academy_gradebook_records to authenticated/i);
  assert.match(sql, /revoke update, delete on public\.academy_gradebook_override_audit from authenticated/i);
  assert.doesNotMatch(sql, /user_metadata/i);
  assert.doesNotMatch(sql, /create policy if not exists/i);
});
