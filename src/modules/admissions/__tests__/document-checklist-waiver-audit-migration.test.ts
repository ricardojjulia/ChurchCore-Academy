import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationName = "20260921100000_application_document_checklist_waiver_audit_check.sql";

test("waiver audit migration requires audit fields whenever status is waived", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations", migrationName),
    "utf8",
  );

  assert.match(
    sql,
    /add constraint academy_application_document_items_waiver_requires_audit/i,
  );
  assert.match(sql, /status\s*<>\s*'waived'/i);
  assert.match(sql, /waived_by_person_id is not null/i);
  assert.match(sql, /waived_at is not null/i);
  assert.match(sql, /waiver_note is not null/i);
  assert.match(sql, /length\(trim\(waiver_note\)\)\s*>\s*0/i);
});
