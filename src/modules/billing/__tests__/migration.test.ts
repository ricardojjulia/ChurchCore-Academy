import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260621050000_billing_student_accounts.sql",
  "utf8",
);

test("billing migration creates account, ledger, and payment intent tables", () => {
  assert.match(migration, /create table if not exists public\.academy_student_accounts/);
  assert.match(migration, /create table if not exists public\.academy_billing_ledger_entries/);
  assert.match(migration, /create table if not exists public\.academy_payment_intents/);
  assert.match(migration, /unique \(tenant_id, idempotency_key\)/);
});

test("billing ledger migration enforces immutability and RLS", () => {
  assert.match(migration, /create trigger academy_billing_ledger_entries_immutable/);
  assert.match(migration, /revoke update, delete on public\.academy_billing_ledger_entries from authenticated/);
  assert.match(migration, /alter table public\.academy_billing_ledger_entries enable row level security/);
  assert.match(migration, /alter table public\.academy_payment_intents force row level security/);
});

test("billing migration does not store provider secrets", () => {
  assert.doesNotMatch(migration, /client_secret/i);
  assert.doesNotMatch(migration, /card_number/i);
  assert.doesNotMatch(migration, /payment_method_secret/i);
});
