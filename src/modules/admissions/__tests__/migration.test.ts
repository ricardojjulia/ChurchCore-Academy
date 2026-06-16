import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";

const migrationName = "20260613142628_admissions_applications.sql";

test("admissions migration follows the security foundation migration", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map(({ name }) => name);

  assert.ok(
    names.indexOf(migrationName) >
      names.indexOf("20260613010000_academy_auth_rls_audit.sql"),
  );
});

test("admissions migration creates tenant-scoped applications and immutable events", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations", migrationName),
    "utf8",
  );

  assert.match(sql, /create table.*public\.academy_admission_applications/i);
  assert.match(sql, /create table.*public\.academy_admission_application_events/i);
  assert.match(sql, /references public\.academy_people/i);
  assert.match(sql, /references public\.academy_programs/i);
  assert.match(sql, /references public\.academy_academic_periods/i);
  assert.match(
    sql,
    /foreign key \(tenant_id, applicant_person_id\)\s+references public\.academy_people \(tenant_id, id\)/i,
  );
  assert.match(
    sql,
    /foreign key \(tenant_id, program_id\)\s+references public\.academy_programs \(tenant_id, id\)/i,
  );
  assert.match(
    sql,
    /foreign key \(tenant_id, application_term_id\)\s+references public\.academy_academic_periods \(tenant_id, id\)/i,
  );
  assert.match(
    sql,
    /foreign key \(tenant_id, application_id\)\s+references public\.academy_admission_applications \(tenant_id, id\)/i,
  );
  assert.match(sql, /check \(status in \(/i);
  assert.match(sql, /idempotency_key/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /academy_private\.academy_current_person_id/i);
  assert.match(sql, /academy_private\.academy_has_active_role/i);
  assert.match(
    sql,
    /academy_has_active_role\(\s*tenant_id,\s*array\['applicant'\]/i,
  );
  assert.match(
    sql,
    /application\.id\s*=\s*academy_admission_application_events\.application_id/i,
  );
  assert.match(
    sql,
    /application\.tenant_id\s*=\s*academy_admission_application_events\.tenant_id/i,
  );
  assert.match(sql, /before update or delete on public\.academy_admission_application_events/i);
  assert.match(
    sql,
    /revoke update, delete on public\.academy_admission_application_events from anon, authenticated/i,
  );
  assert.match(
    sql,
    /before insert or update on public\.academy_admission_applications/i,
  );
  assert.match(sql, /Accepted and declined applications are immutable/i);
  assert.match(sql, /Invalid admission application transition/i);
  assert.match(sql, /New admission applications must be drafts/i);
  assert.match(sql, /Non-terminal applications cannot contain decision metadata/i);
  assert.match(sql, /Terminal admission decisions require decision metadata/i);
  assert.match(sql, /Submitted admission applications require submitted_at/i);
});
