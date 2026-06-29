import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";

const migrationName = "20260615090000_platform_admin_tenant_control_plane.sql";

test("local migration discovery includes the platform admin control-plane migration after learner consent evidence", async () => {
  const migrationFiles = await listMigrationFiles(process.cwd());
  const names = migrationFiles.map((file) => file.name);

  const previousIndex = names.indexOf(
    "20260614204907_learner_consent_evidence.sql",
  );
  const migrationIndex = names.indexOf(migrationName);

  assert.notEqual(previousIndex, -1);
  assert.notEqual(migrationIndex, -1);
  assert.ok(migrationIndex > previousIndex);
});

test("platform admin control-plane migration creates platform role, tenant registry, preference, and audit tables", async () => {
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations", migrationName),
    "utf8",
  );
  const foundationSeed = await readFile(
    join(process.cwd(), "supabase/migrations/20260616085000_seed_demo_institution_foundation.sql"),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.academy_platform_role_assignments/i);
  assert.match(sql, /role in \('platform_staff', 'platform_admin'\)/i);
  assert.match(sql, /create table if not exists public\.academy_tenant_registry/i);
  assert.match(sql, /is_demo boolean not null default false/i);
  assert.match(sql, /create table if not exists public\.academy_platform_user_preferences/i);
  assert.match(sql, /active_tenant_id text not null/i);
  assert.match(sql, /create table if not exists public\.academy_platform_audit_events/i);
  assert.match(sql, /tenant_selected/i);
  assert.match(sql, /tenant_user_provisioned/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\)::text/i);
  assert.match(foundationSeed, /insert into public\.academy_tenant_registry/i);
  assert.match(foundationSeed, /profile\.tenant_id = 'cca-main'/i);
});
