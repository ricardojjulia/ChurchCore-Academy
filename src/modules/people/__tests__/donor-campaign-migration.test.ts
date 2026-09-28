import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const migration = readFileSync(
  "supabase/migrations/20260928020000_donor_campaigns.sql",
  "utf8",
);

test("donor campaign migration creates tenant-scoped campaigns and gift linkage", () => {
  assert.match(migration, /create table if not exists academy_donor_campaigns/);
  assert.match(migration, /tenant_id\s+text not null/);
  assert.match(migration, /goal_amount_cents\s+integer not null check \(goal_amount_cents > 0\)/);
  assert.match(migration, /status in \('planned', 'active', 'paused', 'completed'\)/);
  assert.match(migration, /unique \(tenant_id, id\)/);
  assert.match(migration, /unique \(tenant_id, fund_designation\)/);
  assert.match(migration, /alter table academy_donor_campaigns enable row level security/);
  assert.match(migration, /current_setting\('app\.academy_tenant_id', true\)/);
  assert.match(migration, /add column if not exists donor_campaign_id text/);
  assert.match(migration, /foreign key \(tenant_id, donor_campaign_id\)/);
});

test("donor campaign migration does not add payment-provider or secret storage", () => {
  assert.doesNotMatch(migration, /stripe|payment_intent|secret|token|card/i);
});
