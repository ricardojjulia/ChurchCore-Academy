import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { validateGradingRecordsConfiguration } from "@/modules/grading-records/validation";

test("local migration discovery includes grading records migration after people migration", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map((migration) => migration.name);

  assert.ok(names.includes("20260602020000_people_roles_relationships.sql"));
  assert.ok(names.includes("20260602030000_grading_records.sql"));
  assert.ok(
    names.indexOf("20260602020000_people_roles_relationships.sql") < names.indexOf("20260602030000_grading_records.sql"),
  );
});

test("grading records migration creates tenant-scoped grading configuration storage", async () => {
  const sql = await readFile(join(process.cwd(), "supabase/migrations/20260602030000_grading_records.sql"), "utf8");

  assert.match(sql, /create table if not exists academy_grading_profiles/i);
  assert.match(sql, /create table if not exists academy_evaluation_scales/i);
  assert.match(sql, /create table if not exists academy_evaluation_scale_bands/i);
  assert.match(sql, /create table if not exists academy_evaluation_rule_sets/i);
  assert.match(sql, /create table if not exists academy_official_record_rules/i);
  assert.match(sql, /create table if not exists academy_academic_standing_rules/i);
  assert.match(sql, /tenant_id text not null/i);
  assert.match(sql, /academy_evaluation_scales_tenant_type_idx/i);
  assert.match(sql, /academy_evaluation_rule_sets_tenant_course_idx/i);
  assert.match(sql, /academy_official_record_rules_tenant_record_idx/i);
  assert.match(sql, /academy_academic_standing_rules_tenant_type_idx/i);
});

test("seeded mock Academy dataset includes valid grading records configuration", () => {
  assert.equal(academyDataset.gradingRecords.institutionProfile.tenantId, academyDataset.tenantId);
  assert.ok(academyDataset.gradingRecords.scales.length >= 1);
  assert.ok(academyDataset.gradingRecords.ruleSets.length >= 1);
  assert.ok(academyDataset.gradingRecords.officialRecordRules.length >= 1);
  assert.deepEqual(validateGradingRecordsConfiguration(academyDataset.gradingRecords), []);
});
