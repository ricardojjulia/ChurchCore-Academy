import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260621060000_financial_aid_foundation.sql",
  "utf8",
);

test("financial aid migration creates package award disbursement and hold tables", () => {
  assert.match(migration, /create table if not exists public\.academy_aid_packages/);
  assert.match(migration, /create table if not exists public\.academy_aid_awards/);
  assert.match(migration, /create table if not exists public\.academy_aid_disbursements/);
  assert.match(migration, /create table if not exists public\.academy_aid_holds/);
});

test("financial aid migration keeps federal aid out of allowed award values", () => {
  assert.match(migration, /award_type text not null check \(award_type in \('scholarship', 'grant', 'discount', 'sponsorship'\)\)/);
  assert.match(migration, /source_type text not null check \(source_type in \('institutional', 'denominational', 'mission', 'church'\)\)/);
  assert.doesNotMatch(migration, /federal_grant/);
  assert.doesNotMatch(migration, /federal_loan/);
});

test("financial aid migration enables forced RLS and student self-scope reads", () => {
  for (const table of [
    "academy_aid_packages",
    "academy_aid_awards",
    "academy_aid_disbursements",
    "academy_aid_holds",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} force row level security`),
    );
  }

  assert.match(migration, /student_person_id = academy_private\.academy_current_person_id\(\)/);
});

test("financial aid disbursements link to immutable billing ledger entries", () => {
  assert.match(migration, /ledger_entry_id uuid/);
  assert.match(migration, /references public\.academy_billing_ledger_entries \(tenant_id, id\) on delete restrict/);
  assert.match(migration, /unique \(tenant_id, idempotency_key\)/);
});
