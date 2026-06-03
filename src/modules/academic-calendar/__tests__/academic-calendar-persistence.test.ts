import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { validateAcademicCalendarConfiguration } from "@/modules/academic-calendar/validation";

test("local migration discovery includes academic calendar migration after institution configuration", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map((migration) => migration.name);

  assert.ok(names.includes("20260601010000_academy_institution_config.sql"));
  assert.ok(names.includes("20260601020000_academic_calendar_subdivisions.sql"));
  assert.ok(
    names.indexOf("20260601010000_academy_institution_config.sql") <
      names.indexOf("20260601020000_academic_calendar_subdivisions.sql"),
  );
});

test("academic calendar migration creates tenant-scoped calendar and subdivision storage", async () => {
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations/20260601020000_academic_calendar_subdivisions.sql"),
    "utf8",
  );

  assert.match(sql, /create table if not exists academy_calendar_profiles/i);
  assert.match(sql, /create table if not exists academy_academic_years/i);
  assert.match(sql, /create table if not exists academy_academic_periods/i);
  assert.match(sql, /create table if not exists academy_enrollment_windows/i);
  assert.match(sql, /create table if not exists academy_grading_windows/i);
  assert.match(sql, /create table if not exists academy_transcript_periods/i);
  assert.match(sql, /create table if not exists academy_institution_subdivisions/i);
  assert.match(sql, /tenant_id text not null/i);
  assert.match(sql, /academy_academic_years_tenant_subdivision_idx/i);
  assert.match(sql, /academy_institution_subdivisions_tenant_type_idx/i);
});

test("seeded mock Academy dataset includes valid academic calendar configuration", () => {
  assert.equal(academyDataset.academicCalendar.institutionProfile.tenantId, academyDataset.tenantId);
  assert.deepEqual(validateAcademicCalendarConfiguration(academyDataset.academicCalendar), []);
});
