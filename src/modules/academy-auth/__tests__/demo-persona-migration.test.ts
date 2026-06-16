import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260616093000_seed_demo_persona_accounts.sql",
);

test("demo persona migration creates Supabase auth users and Academy links", async () => {
  const sql = await readFile(migrationPath, "utf8");

  for (const email of [
    "admin@churchcore.academy",
    "teacher@churchcore.academy",
    "student@churchcore.academy",
  ]) {
    assert.match(sql, new RegExp(email, "i"));
  }

  assert.match(sql, /auth\.users/i);
  assert.match(sql, /auth\.identities/i);
  assert.match(sql, /ChurchCore2026!/);
  assert.match(sql, /crypt\([^)]*password[^)]*,\s*gen_salt\('bf'\)/i);
  assert.match(sql, /provider\s*=\s*'supabase'/i);
  assert.match(sql, /person-sophia-marsh/i);
  assert.match(sql, /person-lena-rivera/i);
  assert.match(sql, /institution_admin/i);
  assert.match(sql, /teacher/i);
  assert.match(sql, /student/i);
  assert.doesNotMatch(sql, /supabase_auth/i);
});
