import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { validatePeopleConfiguration } from "@/modules/people/validation";

test("local migration discovery includes people migration after course catalog migration", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map((migration) => migration.name);

  assert.ok(names.includes("20260602010000_course_catalog_sections.sql"));
  assert.ok(names.includes("20260602020000_people_roles_relationships.sql"));
  assert.ok(
    names.indexOf("20260602010000_course_catalog_sections.sql") <
      names.indexOf("20260602020000_people_roles_relationships.sql"),
  );
});

test("people migration creates tenant-scoped people and relationship storage", async () => {
  const sql = await readFile(join(process.cwd(), "supabase/migrations/20260602020000_people_roles_relationships.sql"), "utf8");

  assert.match(sql, /create table if not exists academy_people/i);
  assert.match(sql, /create table if not exists academy_person_role_assignments/i);
  assert.match(sql, /create table if not exists academy_student_profiles/i);
  assert.match(sql, /create table if not exists academy_staff_profiles/i);
  assert.match(sql, /create table if not exists academy_student_relationships/i);
  assert.match(sql, /create table if not exists academy_account_links/i);
  assert.match(sql, /tenant_id text not null/i);
  assert.match(sql, /academy_people_tenant_status_idx/i);
  assert.match(sql, /academy_role_assignments_tenant_person_idx/i);
  assert.match(sql, /academy_student_profiles_tenant_person_idx/i);
  assert.match(sql, /academy_student_relationships_tenant_student_idx/i);
  assert.match(sql, /academy_account_links_tenant_person_idx/i);
});

test("seeded mock Academy dataset includes valid people configuration", () => {
  assert.equal(academyDataset.peopleConfiguration.institutionProfile.tenantId, academyDataset.tenantId);
  assert.ok(academyDataset.peopleConfiguration.people.length >= 5);
  assert.ok(academyDataset.peopleConfiguration.relationships.some((relationship) => relationship.relationshipType === "guardian"));
  assert.deepEqual(validatePeopleConfiguration(academyDataset.peopleConfiguration), []);
});
