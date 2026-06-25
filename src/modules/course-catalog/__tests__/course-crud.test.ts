import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createCourse,
  updateCourse,
  archiveCourse,
  activateCourse,
  type CreateCourseInput,
} from "../mutations";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

class MockDatabase {
  private courses = new Map<string, Record<string, unknown>>();
  private sections = new Map<string, Record<string, unknown>>();
  private prerequisites = new Map<string, Record<string, unknown>>();

  async query(sql: string, params: unknown[]): Promise<QueryResult> {
    const lowerSql = sql.toLowerCase();

    if (lowerSql.includes("insert into academy_courses")) {
      const tenantId = String(params[0]);
      const code = String(params[1]);

      const existing = Array.from(this.courses.values()).find(
        (c) => c.tenant_id === tenantId && c.code === code,
      );
      if (existing) {
        return { rowCount: 0, rows: [] };
      }

      const id = `course-${Date.now()}-${Math.random()}`;
      const row = {
        id,
        tenant_id: params[0],
        code: params[1],
        title: params[2],
        description: params[3],
        course_type: params[4],
        course_level: params[5],
        record_type: params[6],
        default_duration: params[7],
        default_credits: params[8],
        default_clock_hours: params[9],
        default_competency_set_id: params[10],
        owning_subdivision_id: params[11],
        grade_band_subdivision_id: params[12],
        status: "draft",
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.courses.set(id, row);
      return { rowCount: 1, rows: [row] };
    }

    if (lowerSql.includes("update academy_courses")) {
      const tenantId = String(params[0]);
      const courseId = String(params[1]);
      const course = this.courses.get(courseId);

      if (!course || course.tenant_id !== tenantId) {
        return { rowCount: 0, rows: [] };
      }

      const updates: Record<string, unknown> = {};

      if (lowerSql.includes("status = 'archived'")) {
        updates.status = "archived";
      } else if (lowerSql.includes("status = 'active'")) {
        updates.status = "active";
      } else {
        const sets = sql.match(/set\s+(.*?)\s+where/i)?.[1] || "";
        const setParts = sets.split(",").map((s) => s.trim());

        let paramIdx = 2;
        for (const part of setParts) {
          if (part.includes("updated_at")) continue;
          const key = part.split("=")[0].trim();
          if (params[paramIdx] !== undefined) {
            updates[key] = params[paramIdx];
          }
          paramIdx++;
        }
      }

      Object.assign(course, updates, { updated_at: new Date() });
      return { rowCount: 1, rows: [course] };
    }

    if (lowerSql.includes("select") && lowerSql.includes("academy_courses")) {
      const tenantId = String(params[0]);
      const results = Array.from(this.courses.values()).filter(
        (c) => c.tenant_id === tenantId,
      );

      if (params.length > 1) {
        const idOrCode = String(params[1]);
        const match = results.find(
          (c) => c.id === idOrCode || c.code === idOrCode,
        );
        return { rowCount: match ? 1 : 0, rows: match ? [match] : [] };
      }

      return { rowCount: results.length, rows: results };
    }

    if (lowerSql.includes("academy_course_sections")) {
      const tenantId = String(params[0]);
      const courseId = params[1] ? String(params[1]) : null;

      let results = Array.from(this.sections.values()).filter(
        (s) => s.tenant_id === tenantId,
      );

      if (courseId) {
        results = results.filter((s) => s.course_id === courseId);
      }

      if (lowerSql.includes("status not in")) {
        results = results.filter(
          (s) =>
            s.status !== "cancelled" &&
            s.status !== "archived" &&
            s.status !== "completed",
        );
      }

      return { rowCount: results.length, rows: results };
    }

    if (lowerSql.includes("academy_course_prerequisites")) {
      const tenantId = String(params[0]);
      const courseId = String(params[1]);
      const results = Array.from(this.prerequisites.values()).filter(
        (p) => p.tenant_id === tenantId && p.course_id === courseId,
      );
      return { rowCount: results.length, rows: results };
    }

    return { rowCount: 0, rows: [] };
  }

  addSection(section: Record<string, unknown>) {
    this.sections.set(String(section.id), section);
  }

  addPrerequisite(prereq: Record<string, unknown>) {
    this.prerequisites.set(String(prereq.id), prereq);
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

const baseCourseInput: CreateCourseInput = {
  code: "BIB101",
  title: "Introduction to Biblical Studies",
  description: "A foundational course in biblical interpretation.",
  courseType: "bible_course",
  courseLevel: "undergraduate",
  recordType: "official_transcript",
  defaultDuration: {
    durationUnit: "credit_hour",
    durationValue: 3,
    creditHours: 3,
  },
  defaultCredits: 3,
};

describe("course-catalog/mutations", () => {
  test("createCourse() success: created with status draft", async () => {
    const db = new MockDatabase();
    const result = await createCourse(mockActor, baseCourseInput, db);

    assert.strictEqual(result.code, "BIB101");
    assert.strictEqual(result.title, "Introduction to Biblical Studies");
    assert.strictEqual(result.status, "draft");
    assert.strictEqual(result.tenantId, "tenant-1");
  });

  test("createCourse() duplicate code: validation error", async () => {
    const db = new MockDatabase();
    await createCourse(mockActor, baseCourseInput, db);

    await assert.rejects(
      async () => createCourse(mockActor, baseCourseInput, db),
      /already exists/,
    );
  });

  test("createCourse() cross-tenant rejection", async () => {
    const db = new MockDatabase();
    await createCourse(mockActor, baseCourseInput, db);

    const otherCourse = await createCourse(
      otherTenantActor,
      baseCourseInput,
      db,
    );
    assert.strictEqual(otherCourse.tenantId, "tenant-2");
    assert.notStrictEqual(otherCourse.id, undefined);
  });

  test("updateCourse() success: fields updated", async () => {
    const db = new MockDatabase();
    const course = await createCourse(mockActor, baseCourseInput, db);

    const updated = await updateCourse(
      mockActor,
      course.id,
      { title: "Biblical Studies I" },
      db,
    );

    assert.strictEqual(updated.title, "Biblical Studies I");
    assert.strictEqual(updated.code, "BIB101");
  });

  test("updateCourse() code-lock: existing sections block course code change", async () => {
    const db = new MockDatabase();
    const course = await createCourse(mockActor, baseCourseInput, db);

    db.addSection({
      id: "section-1",
      tenant_id: "tenant-1",
      course_id: course.id,
      academic_year_id: "year-1",
      academic_period_id: "period-1",
      section_code: "BIB101-01",
      delivery_mode: "in_person",
      status: "draft",
      primary_instructor_role: "professor",
      assistant_instructor_ids: "[]",
      created_at: new Date(),
      updated_at: new Date(),
    });

    await assert.rejects(
      async () => updateCourse(mockActor, course.id, { code: "BIB102" }, db),
      /Cannot change course code when sections exist/,
    );
  });

  test("archiveCourse() active sections: blocked", async () => {
    const db = new MockDatabase();
    const course = await createCourse(mockActor, baseCourseInput, db);

    db.addSection({
      id: "section-1",
      tenant_id: "tenant-1",
      course_id: course.id,
      academic_year_id: "year-1",
      academic_period_id: "period-1",
      section_code: "BIB101-01",
      delivery_mode: "in_person",
      status: "open",
      primary_instructor_role: "professor",
      assistant_instructor_ids: "[]",
      created_at: new Date(),
      updated_at: new Date(),
    });

    await assert.rejects(
      async () => archiveCourse(mockActor, course.id, db),
      /Cannot archive course with active sections/,
    );
  });

  test("archiveCourse() success: status set to archived", async () => {
    const db = new MockDatabase();
    const course = await createCourse(mockActor, baseCourseInput, db);

    const archived = await archiveCourse(mockActor, course.id, db);
    assert.strictEqual(archived.status, "archived");
  });

  test("activateCourse() success: draft to active", async () => {
    const db = new MockDatabase();
    const course = await createCourse(mockActor, baseCourseInput, db);

    const activated = await activateCourse(mockActor, course.id, db);
    assert.strictEqual(activated.status, "active");
  });

  test("updateCourse() cross-tenant: not found", async () => {
    const db = new MockDatabase();
    const course = await createCourse(mockActor, baseCourseInput, db);

    await assert.rejects(
      async () => updateCourse(otherTenantActor, course.id, { title: "Hacked" }, db),
      /not found/,
    );
  });
});
