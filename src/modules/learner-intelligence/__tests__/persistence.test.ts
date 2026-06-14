import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";

test("local migration discovery includes learner intelligence foundation, RLS, and intervention history migrations", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map((migration) => migration.name);

  assert.ok(names.includes("20260614010000_learner_intelligence_foundation.sql"));
  assert.ok(names.includes("20260614020000_learner_intelligence_rls.sql"));
  assert.ok(names.includes("20260614030000_learner_intervention_status_history.sql"));
  assert.ok(names.includes("20260614204907_learner_consent_evidence.sql"));
  assert.ok(
    names.indexOf("20260614010000_learner_intelligence_foundation.sql") <
      names.indexOf("20260614020000_learner_intelligence_rls.sql"),
  );
  assert.ok(
    names.indexOf("20260614020000_learner_intelligence_rls.sql") <
      names.indexOf("20260614030000_learner_intervention_status_history.sql"),
  );
  assert.ok(
    names.indexOf("20260614030000_learner_intervention_status_history.sql") <
      names.indexOf("20260614204907_learner_consent_evidence.sql"),
  );
});

test("consent evidence migration creates an immutable tenant-scoped ledger", async () => {
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations/20260614204907_learner_consent_evidence.sql"),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.academy_learner_consent_events/i);
  assert.match(sql, /action text not null[\s\S]*granted[\s\S]*updated[\s\S]*revoked/i);
  assert.match(sql, /foreign key \(tenant_id, consent_id\)/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /academy_learner_consent_events: learner read/i);
  assert.doesNotMatch(sql, /create policy "academy_learner_consent_events: learner insert"/i);
  assert.match(sql, /academy_learner_consent_events_immutable/i);
  assert.match(sql, /academy_record_learner_consent_event/i);
  assert.match(sql, /after insert or update on public\.academy_learner_intelligence_consent/i);
  assert.match(sql, /grant select on public\.academy_learner_consent_events to authenticated/i);
  assert.match(sql, /revoke insert on public\.academy_learner_consent_events from authenticated/i);
  assert.doesNotMatch(sql, /grant select, insert on public\.academy_learner_consent_events/i);
});

test("learner intelligence migration creates phase-1 foundation tables and indexes", async () => {
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations/20260614010000_learner_intelligence_foundation.sql"),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.academy_learner_activity_events/i);
  assert.match(sql, /create table if not exists public\.academy_learner_intelligence_consent/i);
  assert.match(sql, /create table if not exists public\.academy_learner_memory/i);
  assert.match(sql, /create or replace view public\.academy_learner_memory_with_confidence[\s\S]*security_invoker\s*=\s*true/i);
  assert.match(sql, /create table if not exists public\.academy_learner_identity_snapshots/i);
  assert.match(sql, /create table if not exists public\.academy_energy_checkins/i);
  assert.match(sql, /create table if not exists public\.academy_intervention_recommendations/i);
  assert.match(sql, /academy_learner_activity_events_tenant_learner_time_idx/i);
  assert.match(sql, /academy_learner_memory_embedding_idx/i);
  assert.match(sql, /academy_intervention_recommendations_tenant_status_idx/i);
  assert.match(sql, /foreign key \(tenant_id, learner_id\)[\s\S]*academy_people \(tenant_id, id\)/i);
  assert.match(sql, /foreign key \(tenant_id, course_id\)[\s\S]*academy_courses \(tenant_id, id\)/i);
  assert.match(sql, /academy_reject_immutable_learner_intelligence_change/i);
});

test("learner intelligence RLS migration enables policies and consent-first checks", async () => {
  const sql = await readFile(join(process.cwd(), "supabase/migrations/20260614020000_learner_intelligence_rls.sql"), "utf8");

  assert.doesNotMatch(sql, /user_metadata/i);
  assert.doesNotMatch(sql, /create policy if not exists/i);
  assert.doesNotMatch(sql, /current_academy_tenant_id/i);
  assert.match(sql, /academy_private\.academy_current_tenant_ids\(\)/i);
  assert.match(sql, /academy_private\.academy_current_person_id\(\)/i);
  assert.match(sql, /academy_private\.academy_has_active_role/i);
  assert.match(sql, /alter table public\.academy_learner_activity_events enable row level security/i);
  assert.match(sql, /alter table public\.academy_learner_activity_events force row level security/i);
  assert.match(sql, /alter table public\.academy_learner_memory enable row level security/i);
  assert.match(sql, /academy_learner_activity_events: consent-first insert/i);
  assert.match(sql, /academy_learner_memory: consent-first staff write/i);
  assert.match(sql, /academy_learner_intelligence_consent: learner insert/i);
  assert.match(sql, /academy_learner_intelligence_consent: learner update/i);
  assert.match(sql, /consent\.consent_behavioral_tracking = true/i);
  assert.match(sql, /consent\.consent_ai_memory = true/i);
  assert.match(sql, /consent\.consent_predictive_modeling = true/i);
});

test("intervention status history migration creates audit table and staff-only policies", async () => {
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations/20260614030000_learner_intervention_status_history.sql"),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.academy_intervention_status_history/i);
  assert.match(sql, /previous_status text not null\s+check/i);
  assert.match(sql, /next_status text not null\s+check/i);
  assert.match(sql, /academy_intervention_status_history_tenant_intervention_changed_idx/i);
  assert.match(sql, /academy_intervention_status_history: staff read/i);
  assert.match(sql, /academy_intervention_status_history: staff write/i);
  assert.match(sql, /alter table public\.academy_intervention_status_history force row level security/i);
  assert.doesNotMatch(sql, /create policy if not exists/i);
  assert.match(sql, /foreign key \(tenant_id, intervention_id\)/i);
});
