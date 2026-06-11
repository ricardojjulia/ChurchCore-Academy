import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";

test("migration discovery includes demo feedback migration", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map((migration) => migration.name);

  assert.ok(names.includes("20260611010000_demo_feedback.sql"));
});

test("demo feedback migration includes atomic limiter and dedupe upsert", async () => {
  const sql = await readFile(join(process.cwd(), "supabase/migrations/20260611010000_demo_feedback.sql"), "utf8");

  assert.match(sql, /create table if not exists academy_demo_feedback/i);
  assert.match(sql, /create table if not exists academy_demo_feedback_rate_limits/i);
  assert.match(sql, /on conflict \(fingerprint\)/i);
  assert.match(sql, /hit_count = academy_demo_feedback.hit_count \+ 1/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /v_count >= 20/i);
  assert.match(sql, /return query select 'rate_limited'/i);
  assert.match(sql, /processed = false/i);
  assert.match(sql, /action = null/i);
});
