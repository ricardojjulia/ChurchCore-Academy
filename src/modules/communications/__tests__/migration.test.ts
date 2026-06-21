import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260621070000_notifications_communications.sql",
  "utf8",
);

test("communications migration creates message preference and audit tables", () => {
  assert.match(migration, /create table if not exists public\.academy_communication_messages/);
  assert.match(migration, /create table if not exists public\.academy_communication_preferences/);
  assert.match(migration, /create table if not exists public\.academy_communication_audit_events/);
});

test("communications migration enables forced RLS on all communication tables", () => {
  for (const table of [
    "academy_communication_messages",
    "academy_communication_preferences",
    "academy_communication_audit_events",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
  }
});

test("communications migration blocks raw provider payload storage and makes audit append-only", () => {
  assert.doesNotMatch(migration, /raw_provider|client_secret|api_key/i);
  assert.match(migration, /academy_communication_audit_events_immutable/);
  assert.match(migration, /before update or delete on public\.academy_communication_audit_events/);
});
