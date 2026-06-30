import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createAcademicYear,
  createTerm,
  updateTerm,
  closeTerm,
  deleteTerm,
  deletePeriod,
  getActiveTerm,
  type CreateAcademicYearInput,
  type CreateTermInput,
} from "../mutations";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

class MockDatabase {
  private years = new Map<string, Record<string, unknown>>();
  private periods = new Map<string, Record<string, unknown>>();
  private enrollmentWindows = new Map<string, Record<string, unknown>>();
  private gradingWindows = new Map<string, Record<string, unknown>>();
  private sections = new Map<string, Record<string, unknown>>();
  private enrollments = new Map<string, Record<string, unknown>>();

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
        period_type: "term",
        starts_on: params[4],
        ends_on: params[5],
        sequence: params[6],
        status: "active",
        parent_period_id: null,
        subdivision_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.periods.set(id, row);
      return { rowCount: 1, rows: [row] };
    }

    if (lowerSql.includes("insert into academy_enrollment_windows")) {
      const id = `window-${Date.now()}-${Math.random()}`;
      const row = {
        id,
        tenant_id: params[0],
        academic_period_id: params[1],
        window_type: params[2],
        opens_at: params[3],
        closes_at: params[4],
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.enrollmentWindows.set(id, row);
      return { rowCount: 1, rows: [row] };
    }

    if (lowerSql.includes("insert into academy_grading_windows")) {
      const id = `grading-${Date.now()}-${Math.random()}`;
      const row = {
        id,
        tenant_id: params[0],
        academic_period_id: params[1],
        opens_at: params[2],
        closes_at: params[3],
        grade_posting_policy: params[4],
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.gradingWindows.set(id, row);
      return { rowCount: 1, rows: [row] };
    }

    if (lowerSql.includes("update academy_academic_periods")) {
      const tenantId = String(params[0]);
      const periodId = String(params[1]);
      const period = this.periods.get(periodId);

      if (!period || period.tenant_id !== tenantId) {
        return { rowCount: 0, rows: [] };
      }

      const updates: Record<string, unknown> = {};

      if (lowerSql.includes("status = 'archived'")) {
        updates.status = "archived";
      } else {
        let paramIdx = 2;

        const sets = sql.match(/set\s+(.*?)\s+where/i)?.[1] || "";
        const setParts = sets.split(",").map((s) => s.trim());

        for (const part of setParts) {
          if (part.includes("updated_at")) continue;
          const key = part.split("=")[0].trim();
          if (params[paramIdx] !== undefined) {
            updates[key] = params[paramIdx];
          }
          paramIdx++;
        }
      }

      Object.assign(period, updates, { updated_at: new Date() });
      return { rowCount: 1, rows: [period] };
    }

    if (lowerSql.includes("delete from academy_academic_periods")) {
      const tenantId = String(params[0]);
      const periodId = String(params[1]);
      const period = this.periods.get(periodId);

      if (!period || period.tenant_id !== tenantId) {
        return { rowCount: 0, rows: [] };
      }

      this.periods.delete(periodId);
      return { rowCount: 1, rows: [] };
    }

    if (lowerSql.includes("select") && lowerSql.includes("academy_academic_years")) {
      const tenantId = String(params[0]);
      const yearId = params[1] ? String(params[1]) : null;

      if (yearId) {
        const year = this.years.get(yearId);
        if (!year || year.tenant_id !== tenantId) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [year] };
      }

      const results = Array.from(this.years.values()).filter(
        (y) => y.tenant_id === tenantId,
      );
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

      let results = Array.from(this.periods.values()).filter(
        (p) => p.tenant_id === tenantId,
      );

      if (lowerSql.includes("period_type = 'term'")) {
        results = results.filter((p) => p.period_type === "term");
      }

      if (lowerSql.includes("status = 'active'")) {
        results = results.filter((p) => p.status === "active");
      }

      if (lowerSql.includes("starts_on <= current_date")) {
        const now = new Date().toISOString().slice(0, 10);
        results = results.filter((p) => {
          const starts = String(p.starts_on);
          return starts <= now;
        });
      }

      if (lowerSql.includes("ends_on >= current_date")) {
        const now = new Date().toISOString().slice(0, 10);
        results = results.filter((p) => {
          const ends = String(p.ends_on);
          return ends >= now;
        });
      }

      return { rowCount: results.length, rows: results };
    }

    if (lowerSql.includes("academy_student_enrollments")) {
      const tenantId = String(params[0]);
      const periodId = params[1] ? String(params[1]) : null;

      let results = Array.from(this.enrollments.values()).filter(
        (e) => e.tenant_id === tenantId,
      );

      if (periodId) {
        const sectionsInPeriod = Array.from(this.sections.values()).filter(
          (s) => s.academic_period_id === periodId,
        );
        const sectionIds = new Set(sectionsInPeriod.map((s) => s.id));
        results = results.filter((e) => sectionIds.has(e.section_id));
      }

      return { rowCount: results.length, rows: results };
    }

    return { rowCount: 0, rows: [] };
  }

  addSection(section: Record<string, unknown>) {
    this.sections.set(String(section.id), section);
  }

  addEnrollment(enrollment: Record<string, unknown>) {
    this.enrollments.set(String(enrollment.id), enrollment);
  }
}

const mockActor: AcademyActor = {
  userId: "user-1",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const otherTenantActor: AcademyActor = {
  userId: "user-2",
  tenantId: "tenant-2",
  roles: ["institution_admin"],
};

const baseYearInput: CreateAcademicYearInput = {
  name: "2025-2026",
  code: "AY2025",
  startsOn: "2025-09-01",
  endsOn: "2026-06-30",
  calendarSystem: "semester",
};

const baseTermInput: CreateTermInput = {
  academicYearId: "year-1",
  name: "Fall 2025",
  code: "FALL2025",
  startsOn: "2025-09-01",
  endsOn: "2025-12-15",
  sequence: 1,
};

describe("academic-calendar/mutations", () => {
  test("createAcademicYear() success", async () => {
    const db = new MockDatabase();
    const year = await createAcademicYear(mockActor, baseYearInput, db);

    assert.strictEqual(year.name, "2025-2026");
    assert.strictEqual(year.code, "AY2025");
    assert.strictEqual(year.status, "active");
  });

  test("createTerm() success with enrollment window", async () => {
    const db = new MockDatabase();
    const year = await createAcademicYear(mockActor, baseYearInput, db);

    const term = await createTerm(
      mockActor,
      {
        ...baseTermInput,
        academicYearId: year.id,
        enrollmentOpensAt: "2025-08-01T00:00:00Z",
        enrollmentClosesAt: "2025-08-31T23:59:59Z",
      },
      db,
    );

    assert.strictEqual(term.name, "Fall 2025");
    assert.strictEqual(term.code, "FALL2025");
    assert.strictEqual(term.status, "active");
  });

  test("createTerm() dates outside year: validation error", async () => {
    const db = new MockDatabase();
    const year = await createAcademicYear(mockActor, baseYearInput, db);

    await assert.rejects(
      async () =>
        createTerm(
          mockActor,
          {
            ...baseTermInput,
            academicYearId: year.id,
            startsOn: "2024-08-01",
            endsOn: "2024-12-15",
          },
          db,
        ),
      /must fall within the academic year boundaries/,
    );
  });

  test("updateTerm() success", async () => {
    const db = new MockDatabase();
    const year = await createAcademicYear(mockActor, baseYearInput, db);
    const term = await createTerm(
      mockActor,
      { ...baseTermInput, academicYearId: year.id },
      db,
    );

    const updated = await updateTerm(
      mockActor,
      term.id,
      { name: "Autumn 2025" },
      false,
      db,
    );

    assert.strictEqual(updated.name, "Autumn 2025");
  });

  test("closeTerm() success: status closed", async () => {
    const db = new MockDatabase();
    const year = await createAcademicYear(mockActor, baseYearInput, db);
    const term = await createTerm(
      mockActor,
      { ...baseTermInput, academicYearId: year.id },
      db,
    );

    const closed = await closeTerm(mockActor, term.id, db);

    assert.strictEqual(closed.status, "archived");
  });

  test("deleteTerm() with enrollments: blocked", async () => {
    const db = new MockDatabase();
    const year = await createAcademicYear(mockActor, baseYearInput, db);
    const term = await createTerm(
      mockActor,
      { ...baseTermInput, academicYearId: year.id },
      db,
    );

    db.addSection({
      id: "section-1",
      tenant_id: "tenant-1",
      academic_period_id: term.id,
      course_id: "course-1",
      section_code: "BIB101-01",
    });
    db.addEnrollment({
      id: "enrollment-1",
      tenant_id: "tenant-1",
      section_id: "section-1",
      student_id: "student-1",
    });

    await assert.rejects(
      async () => deleteTerm(mockActor, term.id, db),
      /Cannot delete term with existing student enrollments/,
    );
  });

  test("getActiveTerm() returns correct active term", async () => {
    const db = new MockDatabase();
    // Use a wide-spanning year so yesterday/tomorrow always fall within bounds
    // regardless of when CI runs.
    const year = await createAcademicYear(
      mockActor,
      { name: "Wide Year", code: "WIDE", startsOn: "2020-01-01", endsOn: "2099-12-31", calendarSystem: "semester" },
      db,
    );

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const term = await createTerm(
      mockActor,
      {
        ...baseTermInput,
        academicYearId: year.id,
        startsOn: yesterday.toISOString().slice(0, 10),
        endsOn: tomorrow.toISOString().slice(0, 10),
      },
      db,
    );

    const activeTerm = await getActiveTerm("tenant-1", db);

    assert.ok(activeTerm);
    assert.strictEqual(activeTerm!.id, term.id);
  });

  test("createAcademicYear() cross-tenant rejection", async () => {
    const db = new MockDatabase();
    await createAcademicYear(mockActor, baseYearInput, db);

    const otherYear = await createAcademicYear(
      otherTenantActor,
      baseYearInput,
      db,
    );

    assert.strictEqual(otherYear.tenantId, "tenant-2");
  });

  test("deletePeriod() success: removes period", async () => {
    const db = new MockDatabase();
    const year = await createAcademicYear(mockActor, baseYearInput, db);
    const term = await createTerm(
      mockActor,
      { ...baseTermInput, academicYearId: year.id },
      db,
    );

    await deletePeriod(mockActor, term.id, db);

    await assert.rejects(
      async () => deletePeriod(mockActor, term.id, db),
      /not found/,
    );
  });

  test("deletePeriod() with enrollments: blocked", async () => {
    const db = new MockDatabase();
    const year = await createAcademicYear(mockActor, baseYearInput, db);
    const term = await createTerm(
      mockActor,
      { ...baseTermInput, academicYearId: year.id },
      db,
    );

    db.addSection({
      id: "section-1",
      tenant_id: "tenant-1",
      academic_period_id: term.id,
      course_id: "course-1",
      section_code: "BIB101-01",
    });
    db.addEnrollment({
      id: "enrollment-1",
      tenant_id: "tenant-1",
      section_id: "section-1",
      student_id: "student-1",
    });

    await assert.rejects(
      async () => deletePeriod(mockActor, term.id, db),
      /Cannot delete period with existing student enrollments/,
    );
  });

  test("deletePeriod() cross-tenant rejection: not found", async () => {
    const db = new MockDatabase();
    const year = await createAcademicYear(mockActor, baseYearInput, db);
    const term = await createTerm(
      mockActor,
      { ...baseTermInput, academicYearId: year.id },
      db,
    );

    await assert.rejects(
      async () => deletePeriod(otherTenantActor, term.id, db),
      /not found/,
    );
  });

  test("updateTerm() cross-tenant: not found", async () => {
    const db = new MockDatabase();
    const year = await createAcademicYear(mockActor, baseYearInput, db);
    const term = await createTerm(
      mockActor,
      { ...baseTermInput, academicYearId: year.id },
      db,
    );

    await assert.rejects(
      async () =>
        updateTerm(otherTenantActor, term.id, { name: "Hacked" }, false, db),
      /not found/,
    );
  });
});
