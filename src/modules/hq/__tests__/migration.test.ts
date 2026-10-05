import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("HQ migration replaces legacy tenant roles with persisted platform-role RLS", async () => {
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations/20261004120000_hq_platform_role_rls.sql"),
    "utf8",
  );

  assert.match(sql, /academy_platform_role_assignments/i);
  assert.match(sql, /academy_is_active_platform_staff/i);
  assert.match(sql, /academy_is_active_platform_admin/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.hq_tasks to authenticated/i);
  assert.match(sql, /user_id = auth\.uid\(\)/i);
  assert.doesNotMatch(sql, /current_user_role\(\) in \('admin','manager','teacher'\)/i);
});
