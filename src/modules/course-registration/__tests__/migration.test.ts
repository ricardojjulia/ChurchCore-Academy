import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";

const migrationName = "20260614040000_course_section_registration_confirmation.sql";
const workflowExpansionMigrationName =
  "20260621020000_expand_course_registration_workflow.sql";

test("local migration discovery includes course registration confirmation migration after enrollment conversion", async () => {
  const migrationFiles = await listMigrationFiles(process.cwd());
  const names = migrationFiles.map((file) => file.name);

  const conversionIndex = names.indexOf(
    "20260613154955_accepted_application_enrollment_conversion.sql",
  );
  const registrationIndex = names.indexOf(migrationName);
  const workflowExpansionIndex = names.indexOf(workflowExpansionMigrationName);

  assert.notEqual(conversionIndex, -1);
  assert.notEqual(registrationIndex, -1);
  assert.notEqual(workflowExpansionIndex, -1);
  assert.ok(registrationIndex > conversionIndex);
  assert.ok(workflowExpansionIndex > registrationIndex);
});

test("course registration migration creates tenant-scoped registration and immutable confirmation events", async () => {
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations", migrationName),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.academy_course_section_registrations/i);
  assert.match(sql, /course_section_id text not null/i);
  assert.match(sql, /source_application_id uuid not null/i);
  assert.match(sql, /confirmed_at timestamptz/i);
  assert.match(sql, /create table if not exists public\.academy_enrollment_confirmation_events/i);
  assert.match(sql, /academy_reject_enrollment_confirmation_event_mutation/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
});

test("course registration workflow expansion adds pending status and audit event vocabulary", async () => {
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations", workflowExpansionMigrationName),
    "utf8",
  );

  assert.match(sql, /drop constraint if exists academy_course_section_registrations_status_check/i);
  assert.match(sql, /check \(status in \('pending_confirmation', 'registered', 'waitlisted', 'withdrawn', 'completed'\)\)/i);
  assert.match(sql, /drop constraint if exists academy_enrollment_confirmation_events_event_type_check/i);
  assert.match(sql, /check \(event_type in \('created', 'waitlisted', 'confirmed', 'withdrawn', 'override'\)\)/i);
});
