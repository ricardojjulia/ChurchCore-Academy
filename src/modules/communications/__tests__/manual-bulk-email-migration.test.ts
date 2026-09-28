import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260928010000_manual_bulk_email_template.sql",
  "utf8",
);

test("manual bulk email migration keeps communications in the existing email boundary", () => {
  assert.match(migration, /manual_bulk_email/);
  assert.match(migration, /academy_communication_messages_template_key_check/);
  assert.doesNotMatch(migration, /'sms'/i);
  assert.doesNotMatch(migration, /provider_payload|api_key|client_secret/i);
});
