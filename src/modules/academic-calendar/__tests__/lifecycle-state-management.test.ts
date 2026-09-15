import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  createPeriod,
  updatePeriod,
  canEditPeriodDates,
  transitionTermState,
  transitionPeriodState,
  archiveTerm,
  archivePeriod,
} from "@/modules/academic-calendar/mutations";

const mockActor: AcademyActor = {
  userId: "user-123",
  tenantId: "tenant-abc",
  roles: ["institution_admin"],
};

describe("Academic Calendar Lifecycle State Management", () => {
  describe("createPeriod", () => {
    it("creates a period successfully within a term", async () => {
      const db = {
        query: async (sql: string, _params: unknown[]) => {
          if (sql.includes("select id, academic_year_id")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "term-123",
                  academic_year_id: "year-456",
                  starts_on: "2025-09-01",
                  ends_on: "2025-12-31",
                },
              ],
            };
          }
          if (sql.includes("select id from academy_academic_periods where")) {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes("insert into academy_academic_periods")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "period-789",
                  tenant_id: "tenant-abc",
                  academic_year_id: "year-456",
                  parent_period_id: "term-123",
                  name: "Midterm Period",
                  code: "MIDTERM2025",
                  period_type: "grading_period",
                  starts_on: "2025-10-15",
                  ends_on: "2025-10-31",
                  sequence: 1,
                  status: "planned",
                  created_at: "2025-09-01T00:00:00Z",
                  updated_at: "2025-09-01T00:00:00Z",
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      const period = await createPeriod(
        mockActor,
        {
          termId: "term-123",
          name: "Midterm Period",
          code: "MIDTERM2025",
          periodType: "grading_period",
          startsOn: "2025-10-15",
          endsOn: "2025-10-31",
          sequence: 1,
        },
        db,
      );

      assert.equal(period.name, "Midterm Period");
      assert.equal(period.status, "planned");
    });

    it("rejects period with dates outside term boundaries", async () => {
      const db = {
        query: async (sql: string) => {
          if (sql.includes("select id, academic_year_id")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "term-123",
                  academic_year_id: "year-456",
                  starts_on: "2025-09-01",
                  ends_on: "2025-12-31",
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      await assert.rejects(
        async () => {
          await createPeriod(
            mockActor,
            {
              termId: "term-123",
              name: "Invalid Period",
              code: "INVALID",
              periodType: "grading_period",
              startsOn: "2026-01-15",
              endsOn: "2026-02-01",
              sequence: 1,
            },
            db,
          );
        },
        { message: "Period dates must fall within the term boundaries." },
      );
    });

    it("rejects cross-tenant period creation", async () => {
      const db = {
        query: async (sql: string) => {
          if (sql.includes("select id, academic_year_id")) {
            return { rowCount: 0, rows: [] };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      await assert.rejects(
        async () => {
          await createPeriod(
            mockActor,
            {
              termId: "term-999",
              name: "Cross Tenant Period",
              code: "CROSS",
              periodType: "grading_period",
              startsOn: "2025-10-15",
              endsOn: "2025-10-31",
              sequence: 1,
            },
            db,
          );
        },
        { message: "Term term-999 not found." },
      );
    });
  });

  describe("updatePeriod", () => {
    it("updates period name while in active state", async () => {
      const db = {
        query: async (sql: string, _params: unknown[]) => {
          if (sql.includes("select id, parent_period_id, status")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "period-789",
                  parent_period_id: "term-123",
                  status: "active",
                },
              ],
            };
          }
          if (sql.includes("update academy_academic_periods")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "period-789",
                  tenant_id: "tenant-abc",
                  academic_year_id: "year-456",
                  parent_period_id: "term-123",
                  name: "Updated Name",
                  code: "MIDTERM2025",
                  period_type: "grading_period",
                  starts_on: "2025-10-15",
                  ends_on: "2025-10-31",
                  sequence: 1,
                  status: "active",
                  created_at: "2025-09-01T00:00:00Z",
                  updated_at: "2025-09-01T00:00:00Z",
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      const period = await updatePeriod(
        mockActor,
        "period-789",
        { name: "Updated Name" },
        db,
      );

      assert.equal(period.name, "Updated Name");
    });

    it("rejects editing dates when term is active", async () => {
      const db = {
        query: async (sql: string) => {
          if (sql.includes("select id, parent_period_id, status")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "period-789",
                  parent_period_id: "term-123",
                  status: "active",
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      await assert.rejects(
        async () => {
          await updatePeriod(
            mockActor,
            "period-789",
            { startsOn: "2025-10-20" },
            db,
          );
        },
        { message: "Cannot edit period dates in active or enrollment_open state." },
      );
    });

    it("rejects editing dates when sections are assigned", async () => {
      const db = {
        query: async (sql: string) => {
          if (sql.includes("select id, parent_period_id, status")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "period-789",
                  parent_period_id: "term-123",
                  status: "planned",
                },
              ],
            };
          }
          if (sql.includes("select count(*) as count from academy_course_sections")) {
            return {
              rowCount: 1,
              rows: [{ count: 5 }],
            };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      await assert.rejects(
        async () => {
          await updatePeriod(
            mockActor,
            "period-789",
            { startsOn: "2025-10-20" },
            db,
          );
        },
        { message: "Cannot edit period dates when course sections are assigned to this period." },
      );
    });

    it("rejects editing completed or archived periods", async () => {
      const db = {
        query: async (sql: string) => {
          if (sql.includes("select id, parent_period_id, status")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "period-789",
                  parent_period_id: "term-123",
                  status: "completed",
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      await assert.rejects(
        async () => {
          await updatePeriod(
            mockActor,
            "period-789",
            { name: "New Name" },
            db,
          );
        },
        { message: "Cannot edit a completed or archived period." },
      );
    });
  });

  describe("canEditPeriodDates", () => {
    it("returns true when no sections are assigned", async () => {
      const db = {
        query: async () => ({
          rowCount: 1,
          rows: [{ count: 0 }],
        }),
      };

      const canEdit = await canEditPeriodDates("period-789", "tenant-abc", db);
      assert.equal(canEdit, true);
    });

    it("returns false when sections are assigned", async () => {
      const db = {
        query: async () => ({
          rowCount: 1,
          rows: [{ count: 3 }],
        }),
      };

      const canEdit = await canEditPeriodDates("period-789", "tenant-abc", db);
      assert.equal(canEdit, false);
    });
  });

  describe("transitionTermState", () => {
    it("transitions term from planned to enrollment_open", async () => {
      const db = {
        query: async (sql: string) => {
          if (sql.includes("select id, status from")) {
            return {
              rowCount: 1,
              rows: [{ id: "term-123", status: "planned" }],
            };
          }
          if (sql.includes("update academy_academic_periods")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "term-123",
                  tenant_id: "tenant-abc",
                  academic_year_id: "year-456",
                  name: "Fall 2025",
                  code: "FALL2025",
                  period_type: "term",
                  starts_on: "2025-09-01",
                  ends_on: "2025-12-31",
                  sequence: 1,
                  status: "enrollment_open",
                  created_at: "2025-09-01T00:00:00Z",
                  updated_at: "2025-09-01T00:00:00Z",
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      const term = await transitionTermState(mockActor, "term-123", "enrollment_open", db);
      assert.equal(term.status, "enrollment_open");
    });

    it("rejects invalid state transition (completed to active)", async () => {
      const db = {
        query: async () => ({
          rowCount: 1,
          rows: [{ id: "term-123", status: "completed" }],
        }),
      };

      await assert.rejects(
        async () => {
          await transitionTermState(mockActor, "term-123", "active", db);
        },
        { message: "Cannot transition from completed to active." },
      );
    });

    it("enforces valid state progression", async () => {
      const db = {
        query: async () => ({
          rowCount: 1,
          rows: [{ id: "term-123", status: "planned" }],
        }),
      };

      await assert.rejects(
        async () => {
          await transitionTermState(mockActor, "term-123", "completed", db);
        },
        { message: "Cannot transition from planned to completed." },
      );
    });
  });

  describe("transitionPeriodState", () => {
    it("transitions period from enrollment_open to active", async () => {
      const db = {
        query: async (sql: string) => {
          if (sql.includes("select id, status from")) {
            return {
              rowCount: 1,
              rows: [{ id: "period-789", status: "enrollment_open" }],
            };
          }
          if (sql.includes("update academy_academic_periods")) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: "period-789",
                  tenant_id: "tenant-abc",
                  academic_year_id: "year-456",
                  parent_period_id: "term-123",
                  name: "Midterm",
                  code: "MIDTERM",
                  period_type: "grading_period",
                  starts_on: "2025-10-15",
                  ends_on: "2025-10-31",
                  sequence: 1,
                  status: "active",
                  created_at: "2025-09-01T00:00:00Z",
                  updated_at: "2025-09-01T00:00:00Z",
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      const period = await transitionPeriodState(mockActor, "period-789", "active", db);
      assert.equal(period.status, "active");
    });
  });

  describe("archiveTerm", () => {
    it("archives term with no active registrations", async () => {
      const db = {
        query: async (sql: string) => {
          if (sql.includes("select id, status from")) {
            return {
              rowCount: 1,
              rows: [{ id: "term-123", status: "completed" }],
            };
          }
          if (sql.includes("select count(*) as count from academy_course_section_registrations")) {
            return {
              rowCount: 1,
              rows: [{ count: 0 }],
            };
          }
          if (sql.includes("update academy_academic_periods")) {
            return { rowCount: 1, rows: [] };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      const result = await archiveTerm(mockActor, "term-123", db);
      assert.equal(result.success, true);
    });

    it("rejects archiving term with active registrations", async () => {
      const db = {
        query: async (sql: string) => {
          if (sql.includes("select id, status from")) {
            return {
              rowCount: 1,
              rows: [{ id: "term-123", status: "completed" }],
            };
          }
          if (sql.includes("select count(*) as count from academy_course_section_registrations")) {
            return {
              rowCount: 1,
              rows: [{ count: 15 }],
            };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      const result = await archiveTerm(mockActor, "term-123", db);
      assert.equal(result.success, false);
      assert.equal(result.blockingRecords, 15);
    });
  });

  describe("archivePeriod", () => {
    it("archives period with no active registrations", async () => {
      const db = {
        query: async (sql: string) => {
          if (sql.includes("select id, status from")) {
            return {
              rowCount: 1,
              rows: [{ id: "period-789", status: "completed" }],
            };
          }
          if (sql.includes("select count(*) as count from academy_course_section_registrations")) {
            return {
              rowCount: 1,
              rows: [{ count: 0 }],
            };
          }
          if (sql.includes("update academy_academic_periods")) {
            return { rowCount: 1, rows: [] };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      const result = await archivePeriod(mockActor, "period-789", db);
      assert.equal(result.success, true);
    });

    it("rejects archiving period with active registrations", async () => {
      const db = {
        query: async (sql: string) => {
          if (sql.includes("select id, status from")) {
            return {
              rowCount: 1,
              rows: [{ id: "period-789", status: "completed" }],
            };
          }
          if (sql.includes("select count(*) as count from academy_course_section_registrations")) {
            return {
              rowCount: 1,
              rows: [{ count: 8 }],
            };
          }
          return { rowCount: 0, rows: [] };
        },
      };

      const result = await archivePeriod(mockActor, "period-789", db);
      assert.equal(result.success, false);
      assert.equal(result.blockingRecords, 8);
    });
  });
});
