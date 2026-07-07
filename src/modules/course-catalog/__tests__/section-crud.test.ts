import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createSection,
  updateSection,
  assignInstructor,
  deleteSection,
  type CreateSectionInput,
} from "../mutations";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

class MockDatabase {
  private courses = new Map<string, Record<string, unknown>>();
  private sections = new Map<string, Record<string, unknown>>();
  private staff = new Map<string, Record<string, unknown>>();
  private enrollments = new Map<string, Record<string, unknown>>();

  async query(sql: string, params: unknown[]): Promise<QueryResult> {
    const lowerSql = sql.toLowerCase();

    if (lowerSql.includes("insert into academy_course_sections")) {
      const tenantId = String(params[0]);
      const courseId = String(params[1]);
      const periodId = String(params[2]);
      const sectionCode = String(params[4]);

      const existing = Array.from(this.sections.values()).find(
        (s) =>
          s.tenant_id === tenantId &&
          s.course_id === courseId &&
          s.academic_period_id === periodId &&
          s.section_code === sectionCode,
      );

      if (existing) {
        throw new Error(`Section ${sectionCode} already exists for this course and period.`);
      }

      const id = `section-${Date.now()}-${Math.random()}`;
      const row = {
        id,
        tenant_id: params[0],
        course_id: params[1],
        academic_period_id: params[2],
        subdivision_id: params[3],
        section_code: params[4],
        title_override: params[5],
        delivery_mode: params[6],
        schedule_pattern: params[7],
        capacity: params[8],
        status: "draft",
        primary_instructor_role: params[9],
        primary_instructor_id: params[10],
        assistant_instructor_ids: "[]",
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.sections.set(id, row);
      return { rowCount: 1, rows: [row] };
    }

    if (lowerSql.includes("update academy_course_sections")) {
      const tenantId = String(params[0]);
      const sectionId = String(params[1]);
      const section = this.sections.get(sectionId);

      if (!section || section.tenant_id !== tenantId) {
        return { rowCount: 0, rows: [] };
      }

      const updates: Record<string, unknown> = {};
      let paramIdx = 2;

      if (lowerSql.includes("primary_instructor_id")) {
        updates.primary_instructor_id = params[2];
      } else {
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

      Object.assign(section, updates, { updated_at: new Date() });
      return { rowCount: 1, rows: [section] };
    }

    if (lowerSql.includes("delete from academy_course_sections")) {
      const tenantId = String(params[0]);
      const sectionId = String(params[1]);
      const section = this.sections.get(sectionId);

      if (!section || section.tenant_id !== tenantId) {
        return { rowCount: 0, rows: [] };
      }

      this.sections.delete(sectionId);
      return { rowCount: 1, rows: [] };
    }

    if (lowerSql.includes("select") && lowerSql.includes("academy_courses")) {
      const tenantId = String(params[0]);
      const courseId = params[1] ? String(params[1]) : null;

      const course = courseId ? this.courses.get(courseId) : null;
      if (courseId && (!course || course.tenant_id !== tenantId)) {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: course ? 1 : 0, rows: course ? [course] : [] };
    }

    if (lowerSql.includes("academy_staff_profiles")) {
      const tenantId = String(params[0]);
      const personId = params[1] ? String(params[1]) : null;

      const staff = personId ? this.staff.get(personId) : null;
      if (personId && (!staff || staff.tenant_id !== tenantId)) {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: staff ? 1 : 0, rows: staff ? [staff] : [] };
    }

    if (lowerSql.includes("academy_course_sections")) {
      const tenantId = String(params[0]);
      const sectionId = params[1] ? String(params[1]) : null;

      if (sectionId) {
        const section = this.sections.get(sectionId);
        if (!section || section.tenant_id !== tenantId) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [section] };
      }

      const results = Array.from(this.sections.values()).filter(
        (s) => s.tenant_id === tenantId,
      );
      return { rowCount: results.length, rows: results };
    }

    if (lowerSql.includes("academy_course_section_registrations")) {
      const tenantId = String(params[0]);
      const sectionId = params[1] ? String(params[1]) : null;

      let results = Array.from(this.enrollments.values()).filter(
        (e) => e.tenant_id === tenantId,
      );

      if (sectionId) {
        results = results.filter((e) => e.section_id === sectionId);
      }

      if (lowerSql.includes("status not in")) {
        results = results.filter(
          (e) => e.status !== "withdrawn",
        );
      }

      if (lowerSql.includes("count(*)")) {
        return {
          rowCount: 1,
          rows: [{ enrollment_count: results.length }],
        };
      }

      return { rowCount: results.length, rows: results };
    }

    return { rowCount: 0, rows: [] };
  }

  addCourse(course: Record<string, unknown>) {
    this.courses.set(String(course.id), course);
  }

  addStaff(staff: Record<string, unknown>) {
    this.staff.set(String(staff.person_id), staff);
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

const baseSectionInput: CreateSectionInput = {
  courseId: "course-1",
  academicPeriodId: "period-1",
  sectionCode: "BIB101-01",
  deliveryMode: "in_person",
  primaryInstructorRole: "professor",
  primaryInstructorId: "instructor-1",
};

describe("course-catalog/section-mutations", () => {
  test("createSection() success: instructor assigned, section visible", async () => {
    const db = new MockDatabase();
    db.addCourse({
      id: "course-1",
      tenant_id: "tenant-1",
      code: "BIB101",
      title: "Biblical Studies",
    });
    db.addStaff({
      id: "staff-1",
      tenant_id: "tenant-1",
      person_id: "instructor-1",
      staff_number: "F001",
    });

    const section = await createSection(mockActor, baseSectionInput, db);

    assert.strictEqual(section.sectionCode, "BIB101-01");
    assert.strictEqual(section.primaryInstructorId, "instructor-1");
    assert.strictEqual(section.status, "draft");
  });

  test("createSection() duplicate code: blocked", async () => {
    const db = new MockDatabase();
    db.addCourse({
      id: "course-1",
      tenant_id: "tenant-1",
      code: "BIB101",
      title: "Biblical Studies",
    });
    db.addStaff({
      id: "staff-1",
      tenant_id: "tenant-1",
      person_id: "instructor-1",
      staff_number: "F001",
    });

    await createSection(mockActor, baseSectionInput, db);

    await assert.rejects(
      async () => createSection(mockActor, baseSectionInput, db),
      /already exists/,
    );
  });

  test("createSection() cross-tenant rejection", async () => {
    const db = new MockDatabase();
    db.addCourse({
      id: "course-1",
      tenant_id: "tenant-1",
      code: "BIB101",
      title: "Biblical Studies",
    });
    db.addStaff({
      id: "staff-1",
      tenant_id: "tenant-1",
      person_id: "instructor-1",
      staff_number: "F001",
    });

    await createSection(mockActor, baseSectionInput, db);

    db.addCourse({
      id: "course-2",
      tenant_id: "tenant-2",
      code: "BIB101",
      title: "Biblical Studies",
    });
    db.addStaff({
      id: "staff-2",
      tenant_id: "tenant-2",
      person_id: "instructor-2",
      staff_number: "F002",
    });

    const otherSection = await createSection(
      otherTenantActor,
      { ...baseSectionInput, courseId: "course-2", primaryInstructorId: "instructor-2" },
      db,
    );

    assert.strictEqual(otherSection.tenantId, "tenant-2");
  });

  test("assignInstructor() success", async () => {
    const db = new MockDatabase();
    db.addCourse({
      id: "course-1",
      tenant_id: "tenant-1",
      code: "BIB101",
      title: "Biblical Studies",
    });
    db.addStaff({
      id: "staff-1",
      tenant_id: "tenant-1",
      person_id: "instructor-1",
      staff_number: "F001",
    });
    db.addStaff({
      id: "staff-2",
      tenant_id: "tenant-1",
      person_id: "instructor-2",
      staff_number: "F002",
    });

    const section = await createSection(mockActor, baseSectionInput, db);
    const updated = await assignInstructor(
      mockActor,
      section.id,
      "instructor-2",
      db,
    );

    assert.strictEqual(updated.primaryInstructorId, "instructor-2");
  });

  test("updateSection() capacity below enrollment: blocked", async () => {
    const db = new MockDatabase();
    db.addCourse({
      id: "course-1",
      tenant_id: "tenant-1",
      code: "BIB101",
      title: "Biblical Studies",
    });
    db.addStaff({
      id: "staff-1",
      tenant_id: "tenant-1",
      person_id: "instructor-1",
      staff_number: "F001",
    });

    const section = await createSection(mockActor, baseSectionInput, db);

    db.addEnrollment({
      id: "enrollment-1",
      tenant_id: "tenant-1",
      section_id: section.id,
      student_id: "student-1",
      status: "enrolled",
    });
    db.addEnrollment({
      id: "enrollment-2",
      tenant_id: "tenant-1",
      section_id: section.id,
      student_id: "student-2",
      status: "enrolled",
    });

    await assert.rejects(
      async () => updateSection(mockActor, section.id, { capacity: 1 }, db),
      /Cannot reduce capacity below current enrollment/,
    );
  });

  test("deleteSection() with enrollments: blocked", async () => {
    const db = new MockDatabase();
    db.addCourse({
      id: "course-1",
      tenant_id: "tenant-1",
      code: "BIB101",
      title: "Biblical Studies",
    });
    db.addStaff({
      id: "staff-1",
      tenant_id: "tenant-1",
      person_id: "instructor-1",
      staff_number: "F001",
    });

    const section = await createSection(mockActor, baseSectionInput, db);

    db.addEnrollment({
      id: "enrollment-1",
      tenant_id: "tenant-1",
      section_id: section.id,
      student_id: "student-1",
      status: "enrolled",
    });

    await assert.rejects(
      async () => deleteSection(mockActor, section.id, db),
      /Cannot delete section with existing enrollments/,
    );
  });

  test("deleteSection() empty: success", async () => {
    const db = new MockDatabase();
    db.addCourse({
      id: "course-1",
      tenant_id: "tenant-1",
      code: "BIB101",
      title: "Biblical Studies",
    });
    db.addStaff({
      id: "staff-1",
      tenant_id: "tenant-1",
      person_id: "instructor-1",
      staff_number: "F001",
    });

    const section = await createSection(mockActor, baseSectionInput, db);

    await deleteSection(mockActor, section.id, db);

    const result = await db.query(
      "select * from academy_course_sections where id = $1",
      [section.id],
    );
    assert.strictEqual(result.rowCount, 0);
  });

  test("updateSection() cross-tenant: not found", async () => {
    const db = new MockDatabase();
    db.addCourse({
      id: "course-1",
      tenant_id: "tenant-1",
      code: "BIB101",
      title: "Biblical Studies",
    });
    db.addStaff({
      id: "staff-1",
      tenant_id: "tenant-1",
      person_id: "instructor-1",
      staff_number: "F001",
    });

    const section = await createSection(mockActor, baseSectionInput, db);

    await assert.rejects(
      async () =>
        updateSection(otherTenantActor, section.id, { capacity: 50 }, db),
      /not found/,
    );
  });
});
