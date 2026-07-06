import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getDatabasePool } from "@/lib/database";
import { resolveAcademicContext, saveAcademicContext } from "../user-context-repository";
import { createAcademicYear, createTerm } from "../mutations";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

interface Queryable {
  query(sql: string, params: unknown[]): Promise<QueryResult>;
}

const testTenantId = "test-tenant-context";
const testUserId = "test-user-context-001";

const actor: AcademyActor = {
  userId: testUserId,
  tenantId: testTenantId,
  roles: ["institution_admin"],
};

describe("user-context-repository", () => {
  test("resolveAcademicContext defaults to active year and period when no saved context", async () => {
    const pool = getDatabasePool();
    const client = await pool.connect();

    try {
      await client.query("begin");

      // Seed institution profile (required FK before creating academic year)
      await client.query(
        `INSERT INTO academy_institution_profiles (tenant_id, institution_name, legal_name, primary_mode, supported_modes, operating_rules, capabilities, lms_preference, created_at, updated_at)
         VALUES ($1, $2, $3, $4, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now())
         ON CONFLICT (tenant_id) DO NOTHING`,
        [testTenantId, "Test Institution", "Test Institution Legal", "college"],
      );

      // Create an academic year
      const year = await createAcademicYear(
        actor,
        {
          name: "Test Year 2026",
          code: "TY2026",
          startsOn: "2026-01-01",
          endsOn: "2026-12-31",
          calendarSystem: "semester",
        },
        client as unknown as Queryable,
      );

      // Create a period
      const period = await createTerm(
        actor,
        {
          academicYearId: year.id,
          name: "Fall 2026",
          code: "FALL2026",
          periodType: "semester",
          startsOn: "2026-09-01",
          endsOn: "2026-12-15",
          sequence: 1,
        },
        client as unknown as Queryable,
      );

      // Resolve context with no saved context
      const result = await resolveAcademicContext(
        testUserId,
        testTenantId,
        client as unknown as Queryable,
      );

      assert.strictEqual(result.context.yearId, year.id);
      assert.strictEqual(result.context.periodId, period.period.id);
      assert.strictEqual(result.options.years.length, 1);
      assert.strictEqual(result.options.years[0].id, year.id);

      await client.query("rollback");
    } finally {
      client.release();
    }
  });

  test("saveAcademicContext persists and resolveAcademicContext reads saved values", async () => {
    const pool = getDatabasePool();
    const client = await pool.connect();

    try {
      await client.query("begin");

      // Seed institution profile (required FK before creating academic year)
      await client.query(
        `INSERT INTO academy_institution_profiles (tenant_id, institution_name, legal_name, primary_mode, supported_modes, operating_rules, capabilities, lms_preference, created_at, updated_at)
         VALUES ($1, $2, $3, $4, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now())
         ON CONFLICT (tenant_id) DO NOTHING`,
        [testTenantId, "Test Institution", "Test Institution Legal", "college"],
      );

      // Create an academic year
      const year = await createAcademicYear(
        actor,
        {
          name: "Test Year 2027",
          code: "TY2027",
          startsOn: "2027-01-01",
          endsOn: "2027-12-31",
          calendarSystem: "semester",
        },
        client as unknown as Queryable,
      );

      // Create a period
      const period = await createTerm(
        actor,
        {
          academicYearId: year.id,
          name: "Spring 2027",
          code: "SPRING2027",
          periodType: "semester",
          startsOn: "2027-01-15",
          endsOn: "2027-05-15",
          sequence: 1,
        },
        client as unknown as Queryable,
      );

      // Save context
      await saveAcademicContext(
        testUserId,
        testTenantId,
        year.id,
        period.period.id,
        client as unknown as Queryable,
      );

      // Resolve context
      const result = await resolveAcademicContext(
        testUserId,
        testTenantId,
        client as unknown as Queryable,
      );

      assert.strictEqual(result.context.yearId, year.id);
      assert.strictEqual(result.context.periodId, period.period.id);

      await client.query("rollback");
    } finally {
      client.release();
    }
  });

  test("cross-tenant isolation: saved context for tenant A cannot be read by tenant B actor", async () => {
    const pool = getDatabasePool();
    const client = await pool.connect();

    try {
      await client.query("begin");

      const tenantA = "tenant-a-context";
      const tenantB = "tenant-b-context";
      const user = "shared-user-001";

      const actorA: AcademyActor = { userId: user, tenantId: tenantA, roles: ["institution_admin"] };
      const actorB: AcademyActor = { userId: user, tenantId: tenantB, roles: ["institution_admin"] };

      // Seed institution profiles for both tenants (required FK before creating academic years)
      await client.query(
        `INSERT INTO academy_institution_profiles (tenant_id, institution_name, legal_name, primary_mode, supported_modes, operating_rules, capabilities, lms_preference, created_at, updated_at)
         VALUES ($1, $2, $3, $4, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now()),
                ($5, $6, $7, $8, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now())
         ON CONFLICT (tenant_id) DO NOTHING`,
        [tenantA, "Tenant A Institution", "Tenant A Legal", "college", tenantB, "Tenant B Institution", "Tenant B Legal", "college"],
      );

      // Create year for tenant A
      const yearA = await createAcademicYear(
        actorA,
        {
          name: "Tenant A Year",
          code: "TAY01",
          startsOn: "2026-01-01",
          endsOn: "2026-12-31",
          calendarSystem: "semester",
        },
        client as unknown as Queryable,
      );

      // Create year for tenant B
      const yearB = await createAcademicYear(
        actorB,
        {
          name: "Tenant B Year",
          code: "TBY01",
          startsOn: "2026-01-01",
          endsOn: "2026-12-31",
          calendarSystem: "semester",
        },
        client as unknown as Queryable,
      );

      // Save context for tenant A
      await saveAcademicContext(user, tenantA, yearA.id, null, client as unknown as Queryable);

      // Resolve context for tenant B - should only see tenant B data
      const resultB = await resolveAcademicContext(user, tenantB, client as unknown as Queryable);

      assert.strictEqual(resultB.context.yearId, yearB.id);
      assert.strictEqual(resultB.options.years.length, 1);
      assert.strictEqual(resultB.options.years[0].id, yearB.id);

      // Verify tenant B does not see tenant A's year
      const tenantAYearInResultB = resultB.options.years.find((y) => y.id === yearA.id);
      assert.strictEqual(tenantAYearInResultB, undefined);

      await client.query("rollback");
    } finally {
      client.release();
    }
  });
});
