import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";

const securityMigrationName =
  "20260613010000_academy_auth_rls_audit.sql";

test("security migration protects every existing Academy table with forced RLS", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const tableNames = new Set<string>();

  for (const migration of migrations) {
    if (migration.name === securityMigrationName) continue;
    const sql = await readFile(migration.path, "utf8");
    for (const match of sql.matchAll(
      /create table if not exists ([a-z_]+)/gi,
    )) {
      tableNames.add(match[1].toLowerCase());
    }
  }

  const sql = await readFile(
    join(process.cwd(), "supabase/migrations", securityMigrationName),
    "utf8",
  );

  for (const tableName of tableNames) {
    assert.match(
      sql,
      new RegExp(`'${tableName}'`, "i"),
      `${tableName} must be present in the protected table inventory`,
    );
  }

  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /academy_current_external_subject/i);
  assert.match(sql, /academy_current_person_id/i);
  assert.match(sql, /academy_current_tenant_ids/i);
  assert.match(sql, /academy_has_active_role/i);
  assert.match(sql, /academy_can_read_student/i);
});

test("security migration creates immutable tenant-scoped audit events", async () => {
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations", securityMigrationName),
    "utf8",
  );

  assert.match(
    sql,
    /create table if not exists (?:public\.)?academy_audit_events/i,
  );
  assert.match(sql, /tenant_id text not null/i);
  assert.match(sql, /actor_person_id text/i);
  assert.match(sql, /correlation_id text/i);
  assert.match(sql, /idempotency_key text/i);
  assert.match(sql, /redacted_metadata jsonb/i);
  assert.match(sql, /academy_reject_audit_mutation/i);
  assert.match(
    sql,
    /before update or delete on (?:public\.)?academy_audit_events/i,
  );
});
