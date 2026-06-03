import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { validateCourseCatalogConfiguration } from "@/modules/course-catalog/validation";

test("local migration discovery includes course catalog migration after academic calendar migration", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map((migration) => migration.name);

  assert.ok(names.includes("20260601020000_academic_calendar_subdivisions.sql"));
  assert.ok(names.includes("20260602010000_course_catalog_sections.sql"));
  assert.ok(
    names.indexOf("20260601020000_academic_calendar_subdivisions.sql") <
      names.indexOf("20260602010000_course_catalog_sections.sql"),
  );
});

test("course catalog migration creates tenant-scoped course storage", async () => {
  const sql = await readFile(join(process.cwd(), "supabase/migrations/20260602010000_course_catalog_sections.sql"), "utf8");

  assert.match(sql, /create table if not exists academy_course_catalog_profiles/i);
  assert.match(sql, /create table if not exists academy_courses/i);
  assert.match(sql, /create table if not exists academy_course_sections/i);
  assert.match(sql, /create table if not exists academy_course_prerequisites/i);
  assert.match(sql, /create table if not exists academy_course_lms_mappings/i);
  assert.match(sql, /tenant_id text not null/i);
  assert.match(sql, /academy_courses_tenant_code_idx/i);
  assert.match(sql, /academy_course_sections_tenant_period_idx/i);
  assert.match(sql, /academy_course_lms_mappings_tenant_status_idx/i);
});

test("seeded mock Academy dataset includes valid course catalog configuration", () => {
  assert.equal(academyDataset.courseCatalog.institutionProfile.tenantId, academyDataset.tenantId);
  assert.deepEqual(validateCourseCatalogConfiguration(academyDataset.courseCatalog), []);
});
