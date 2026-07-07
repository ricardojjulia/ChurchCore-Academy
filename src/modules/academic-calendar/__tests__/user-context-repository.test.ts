import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveAcademicContext, saveAcademicContext } from "../user-context-repository";
import { createAcademicYear, createTerm } from "../mutations";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

class MockDatabase {
  private years = new Map<string, Record<string, unknown>>();
  private periods = new Map<string, Record<string, unknown>>();
  private userContext = new Map<string, Record<string, unknown>>();

  async query(sql: string, params: unknown[]): Promise<QueryResult> {
    const lowerSql = sql.toLowerCase();

    if (lowerSql.includes("insert into academy_academic_years")) {
      const tenantId = String(params[0]);
      const code = String(params[2]);

      const existing = Array.from(this.years.values()).find(
        (y) => y.tenant_id === tenantId && y.code === code,
      );
      if (existing) {
        return { rowCount: 0, rows: [] };
      }

      const id = `year-${Date.now()}-${Math.random()}`;
      const row = {
        id,
        tenant_id: params[0],
        name: params[1],
        code: params[2],
        starts_on: params[3],
        ends_on: params[4],
        status: "active",
        calendar_system: params[5],
        subdivision_id: params[6],
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.years.set(id, row);
      return { rowCount: 1, rows: [row] };
    }

    if (lowerSql.includes("insert into academy_academic_periods")) {
      const tenantId = String(params[0]);
      const yearId = String(params[1]);
      const code = String(params[3]);

      const existing = Array.from(this.periods.values()).find(
        (p) =>
          p.tenant_id === tenantId &&
          p.academic_year_id === yearId &&
          p.code === code,
      );
      if (existing) {
        return { rowCount: 0, rows: [] };
      }

      const id = `period-${Date.now()}-${Math.random()}`;
      const row = {
        id,
        tenant_id: params[0],
        academic_year_id: params[1],
        name: params[2],
        code: params[3],
        period_type: params[4] ?? "term",
        starts_on: params[5],
        ends_on: params[6],
        sequence: params[7],
        status: "planned",
        parent_period_id: null,
        subdivision_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.periods.set(id, row);
      return { rowCount: 1, rows: [row] };
    }

    if (lowerSql.includes("academy_user_context")) {
      if (lowerSql.startsWith("insert into academy_user_context")) {
        const userId = String(params[0]);
        const tenantId = String(params[1]);
        const row = {
          user_id: userId,
          tenant_id: tenantId,
          active_academic_year_id: params[2],
          active_academic_period_id: params[3],
          updated_at: new Date(),
        };
        this.userContext.set(`${userId}::${tenantId}`, row);
        return { rowCount: 1, rows: [row] };
      }

      const userId = String(params[0]);
      const tenantId = String(params[1]);
      const row = this.userContext.get(`${userId}::${tenantId}`);
      return row ? { rowCount: 1, rows: [row] } : { rowCount: 0, rows: [] };
    }

    if (lowerSql.includes("academy_academic_years")) {
      const tenantId = String(params[0]);
      const yearId = params[1] ? String(params[1]) : null;

      if (yearId) {
        const year = this.years.get(yearId);
        if (!year || year.tenant_id !== tenantId) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [year] };
      }

      const results = Array.from(this.years.values())
        .filter((y) => y.tenant_id === tenantId && y.status !== "archived")
        .sort((a, b) => String(b.starts_on).localeCompare(String(a.starts_on)));
      return { rowCount: results.length, rows: results };
    }

    if (lowerSql.includes("academy_academic_periods")) {
      const tenantId = String(params[0]);
      const periodId = params[1] ? String(params[1]) : null;

      if (periodId) {
        const period = this.periods.get(periodId);
        if (!period || period.tenant_id !== tenantId) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [period] };
      }

      const results = Array.from(this.periods.values())
        .filter((p) => p.tenant_id === tenantId && p.status !== "archived")
        .sort((a, b) => {
          const yearCmp = String(a.academic_year_id).localeCompare(String(b.academic_year_id));
          if (yearCmp !== 0) return yearCmp;
          return Number(a.sequence) - Number(b.sequence);
        });
      return { rowCount: results.length, rows: results };
    }

    return { rowCount: 0, rows: [] };
  }
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
    const db = new MockDatabase();

    const year = await createAcademicYear(
      actor,
      {
        name: "Test Year 2026",
        code: "TY2026",
        startsOn: "2026-01-01",
        endsOn: "2026-12-31",
        calendarSystem: "semester",
      },
      db,
    );

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
      db,
    );

    const result = await resolveAcademicContext(testUserId, testTenantId, db);

    assert.strictEqual(result.context.yearId, year.id);
    assert.strictEqual(result.context.periodId, period.period.id);
    assert.strictEqual(result.options.years.length, 1);
    assert.strictEqual(result.options.years[0].id, year.id);
  });

  test("saveAcademicContext persists and resolveAcademicContext reads saved values", async () => {
    const db = new MockDatabase();

    const year = await createAcademicYear(
      actor,
      {
        name: "Test Year 2027",
        code: "TY2027",
        startsOn: "2027-01-01",
        endsOn: "2027-12-31",
        calendarSystem: "semester",
      },
      db,
    );

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
      db,
    );

    await saveAcademicContext(testUserId, testTenantId, year.id, period.period.id, db);

    const result = await resolveAcademicContext(testUserId, testTenantId, db);

    assert.strictEqual(result.context.yearId, year.id);
    assert.strictEqual(result.context.periodId, period.period.id);
  });

  test("cross-tenant isolation: saved context for tenant A cannot be read by tenant B actor", async () => {
    const db = new MockDatabase();

    const tenantA = "tenant-a-context";
    const tenantB = "tenant-b-context";
    const user = "shared-user-001";

    const actorA: AcademyActor = { userId: user, tenantId: tenantA, roles: ["institution_admin"] };
    const actorB: AcademyActor = { userId: user, tenantId: tenantB, roles: ["institution_admin"] };

    const yearA = await createAcademicYear(
      actorA,
      {
        name: "Tenant A Year",
        code: "TAY01",
        startsOn: "2026-01-01",
        endsOn: "2026-12-31",
        calendarSystem: "semester",
      },
      db,
    );

    const yearB = await createAcademicYear(
      actorB,
      {
        name: "Tenant B Year",
        code: "TBY01",
        startsOn: "2026-01-01",
        endsOn: "2026-12-31",
        calendarSystem: "semester",
      },
      db,
    );

    await saveAcademicContext(user, tenantA, yearA.id, null, db);

    const resultB = await resolveAcademicContext(user, tenantB, db);

    assert.strictEqual(resultB.context.yearId, yearB.id);
    assert.strictEqual(resultB.options.years.length, 1);
    assert.strictEqual(resultB.options.years[0].id, yearB.id);

    const tenantAYearInResultB = resultB.options.years.find((y) => y.id === yearA.id);
    assert.strictEqual(tenantAYearInResultB, undefined);
  });
});
