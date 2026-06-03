import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { listMigrationFiles } from "@/lib/migrations";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { validateInstitutionProfile } from "@/modules/academy-config/validation";

test("local migration discovery includes institution configuration migration after base Academy migration", async () => {
  const migrations = await listMigrationFiles(process.cwd());
  const names = migrations.map((migration) => migration.name);

  assert.ok(names.includes("20260424010000_shepherd_ai_academy.sql"));
  assert.ok(names.includes("20260601010000_academy_institution_config.sql"));
  assert.ok(
    names.indexOf("20260424010000_shepherd_ai_academy.sql") <
      names.indexOf("20260601010000_academy_institution_config.sql"),
  );
});

test("institution configuration migration creates tenant-scoped profile storage", async () => {
  const sql = await readFile(
    join(process.cwd(), "supabase/migrations/20260601010000_academy_institution_config.sql"),
    "utf8",
  );

  assert.match(sql, /create table if not exists academy_institution_profiles/i);
  assert.match(sql, /tenant_id text primary key/i);
  assert.match(sql, /primary_mode text not null/i);
  assert.match(sql, /supported_modes jsonb not null/i);
  assert.match(sql, /operating_rules jsonb not null/i);
  assert.match(sql, /capabilities jsonb not null/i);
  assert.match(sql, /lms_preference jsonb not null/i);
  assert.match(sql, /academy_institution_profiles_updated_at_idx/i);
});

test("seeded mock Academy dataset includes a valid institution profile", () => {
  assert.equal(academyDataset.institutionProfile.tenantId, academyDataset.tenantId);
  assert.equal(academyDataset.institutionProfile.primaryMode, "mixed");
  assert.deepEqual(validateInstitutionProfile(academyDataset.institutionProfile), []);
});
