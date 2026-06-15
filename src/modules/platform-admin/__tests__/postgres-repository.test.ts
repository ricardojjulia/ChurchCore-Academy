import assert from "node:assert/strict";
import test from "node:test";
import { PostgresPlatformAdminRepository } from "@/modules/platform-admin/postgres-repository";

test("tenant provisioning writes baseline tenant records in a transaction", async () => {
  const statements: string[] = [];
  const repository = new PostgresPlatformAdminRepository({
    query: async (sql) => {
      statements.push(sql.trim().toLowerCase());
      return { rows: [], rowCount: 1 };
    },
  });

  const created = await repository.provisionTenant({
    externalSubject: "supabase-user-1",
    tenantId: "north-academy",
    displayName: "North Academy",
    institutionName: "North Academy",
    legalName: "North Academy LLC",
    primaryMode: "college",
    lifecycleStatus: "development",
    isDemo: false,
    initialInstitutionAdmin: {
      displayName: "North Admin",
      email: "admin@north.test",
    },
  });

  assert.equal(created.tenantId, "north-academy");
  assert.equal(created.provisioningStatus, "ready");
  assert.ok(statements.includes("begin"));
  assert.ok(statements.includes("commit"));
  assert.ok(
    statements.some((statement) =>
      statement.includes("insert into public.academy_tenant_registry"),
    ),
  );
  assert.ok(
    statements.some((statement) =>
      statement.includes("insert into public.academy_institution_profiles"),
    ),
  );
  assert.ok(
    statements.some((statement) =>
      statement.includes("insert into public.academy_calendar_profiles"),
    ),
  );
  assert.ok(
    statements.some((statement) =>
      statement.includes("insert into public.academy_grading_profiles"),
    ),
  );
  assert.ok(
    statements.some((statement) =>
      statement.includes("insert into public.academy_course_catalog_profiles"),
    ),
  );
  assert.ok(
    statements.some((statement) =>
      statement.includes("insert into public.academy_thresholds"),
    ),
  );
  assert.ok(
    statements.some((statement) =>
      statement.includes("insert into public.academy_institution_subdivisions"),
    ),
  );
  assert.ok(
    statements.some((statement) =>
      statement.includes("insert into public.academy_people"),
    ),
  );
  assert.ok(
    statements.some((statement) =>
      statement.includes("insert into public.academy_person_role_assignments"),
    ),
  );
  assert.ok(
    statements.some((statement) =>
      statement.includes("insert into public.academy_account_links"),
    ),
  );
  assert.ok(
    statements.some((statement) =>
      statement.includes("insert into public.academy_platform_audit_events"),
    ),
  );
});

test("tenant provisioning rolls back and maps duplicate key errors", async () => {
  const statements: string[] = [];
  const repository = new PostgresPlatformAdminRepository({
    query: async (sql) => {
      const lowered = sql.trim().toLowerCase();
      statements.push(lowered);
      if (lowered.includes("insert into public.academy_tenant_registry")) {
        throw new Error('duplicate key value violates unique constraint "academy_tenant_registry_pkey"');
      }
      return { rows: [], rowCount: 1 };
    },
  });

  await assert.rejects(
    () =>
      repository.provisionTenant({
        externalSubject: "supabase-user-1",
        tenantId: "north-academy",
        displayName: "North Academy",
        institutionName: "North Academy",
        legalName: "North Academy LLC",
        primaryMode: "college",
        lifecycleStatus: "development",
        isDemo: false,
        initialInstitutionAdmin: {
          displayName: "North Admin",
          email: "admin@north.test",
        },
      }),
    /Tenant already exists/,
  );

  assert.ok(statements.includes("begin"));
  assert.ok(statements.includes("rollback"));
});

test("tenant provisioning does not map non-duplicate SQL unique-word errors", async () => {
  const repository = new PostgresPlatformAdminRepository({
    query: async (sql) => {
      const lowered = sql.trim().toLowerCase();
      if (lowered.includes("insert into public.academy_person_role_assignments")) {
        throw new Error(
          "there is no unique or exclusion constraint matching the ON CONFLICT specification",
        );
      }
      return { rows: [], rowCount: 1 };
    },
  });

  await assert.rejects(
    () =>
      repository.provisionTenant({
        externalSubject: "supabase-user-1",
        tenantId: "north-academy",
        displayName: "North Academy",
        institutionName: "North Academy",
        legalName: "North Academy LLC",
        primaryMode: "college",
        lifecycleStatus: "development",
        isDemo: false,
        initialInstitutionAdmin: {
          displayName: "North Admin",
          email: "admin@north.test",
        },
      }),
    /no unique or exclusion constraint matching the ON CONFLICT specification/,
  );
});
