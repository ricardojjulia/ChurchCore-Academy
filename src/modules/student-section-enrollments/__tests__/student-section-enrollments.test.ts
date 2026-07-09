import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { PostgresStudentSectionEnrollmentRepository } from "../postgres-repository";
import { StudentSectionEnrollmentService } from "../service";
import type { StudentSectionEnrollment } from "../types";

const registrar: AcademyActor = {
  userId: "person-registrar",
  tenantId: "tenant-1",
  roles: ["registrar"],
};

const student: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

function enrollment(overrides: Partial<StudentSectionEnrollment> = {}): StudentSectionEnrollment {
  return {
    id: "registration-1",
    tenantId: "tenant-1",
    studentProfileId: "student-profile-1",
    studentPersonId: "person-student-1",
    courseSectionId: "section-1",
    programEnrollmentId: "program-enrollment-1",
    periodRegistrationId: "period-registration-1",
    status: "registered",
    registeredAt: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

function enrollmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "registration-1",
    tenant_id: "tenant-1",
    student_profile_id: "student-profile-1",
    student_person_id: "person-student-1",
    course_section_id: "section-1",
    program_enrollment_id: "program-enrollment-1",
    period_registration_id: "period-registration-1",
    status: "registered",
    registered_at: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

test("service rejects student actors assigning sections", async () => {
  const service = new StudentSectionEnrollmentService({
    listAvailableSections: async () => [],
    assignSection: async () => enrollment(),
  });

  await assert.rejects(
    () =>
      service.assignSection(student, {
        studentProfileId: "student-profile-1",
        courseSectionId: "section-1",
      }),
    { name: "AcademyAuthorizationError" },
  );
});

test("service normalizes staff section assignment input", async () => {
  let captured: unknown;
  const service = new StudentSectionEnrollmentService({
    listAvailableSections: async () => [],
    assignSection: async (_tenantId, input) => {
      captured = input;
      return enrollment();
    },
  });

  await service.assignSection(registrar, {
    studentProfileId: " student-profile-1 ",
    courseSectionId: " section-1 ",
  });

  assert.deepEqual(captured, {
    studentProfileId: "student-profile-1",
    courseSectionId: "section-1",
  });
});

test("repository creates missing period registration from active program membership", async () => {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const repo = new PostgresStudentSectionEnrollmentRepository({
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("from academy_student_profiles")) {
        return { rowCount: 1, rows: [{ id: "student-profile-1", person_id: "person-student-1" }] };
      }
      if (sql.includes("from academy_program_enrollments")) {
        return { rowCount: 1, rows: [{ id: "program-enrollment-1", student_person_id: "person-student-1" }] };
      }
      if (sql.includes("from academy_course_sections") && sql.includes("for update")) {
        return {
          rowCount: 1,
          rows: [{
            id: "section-1",
            academic_period_id: "period-1",
            status: "open",
            capacity: 20,
            current_enrollment: 3,
          }],
        };
      }
      if (sql.includes("from academy_course_section_registrations") && sql.includes("status in")) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes("from academy_period_registrations")) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes("insert into academy_period_registrations")) {
        return { rowCount: 1, rows: [{ id: "period-registration-1" }] };
      }
      if (sql.includes("insert into academy_course_section_registrations")) {
        return { rowCount: 1, rows: [enrollmentRow()] };
      }
      return { rowCount: 1, rows: [] };
    },
  });

  const saved = await repo.assignSection("tenant-1", {
    studentProfileId: "student-profile-1",
    courseSectionId: "section-1",
  });

  assert.equal(saved.id, "registration-1");
  assert.ok(calls.some((call) => call.sql.includes("insert into academy_period_registrations")));
  assert.ok(calls.some((call) => call.sql.includes("insert into academy_course_section_registrations")));
  assert.ok(calls.some((call) => call.sql.includes("update academy_student_profiles")));
});

test("repository returns existing active registration idempotently", async () => {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const repo = new PostgresStudentSectionEnrollmentRepository({
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("from academy_student_profiles")) {
        return { rowCount: 1, rows: [{ id: "student-profile-1", person_id: "person-student-1" }] };
      }
      if (sql.includes("from academy_program_enrollments")) {
        return { rowCount: 1, rows: [{ id: "program-enrollment-1", student_person_id: "person-student-1" }] };
      }
      if (sql.includes("from academy_course_sections") && sql.includes("for update")) {
        return {
          rowCount: 1,
          rows: [{
            id: "section-1",
            academic_period_id: "period-1",
            status: "open",
            capacity: 20,
            current_enrollment: 3,
          }],
        };
      }
      if (sql.includes("from academy_course_section_registrations") && sql.includes("status in")) {
        return { rowCount: 1, rows: [enrollmentRow()] };
      }
      return { rowCount: 1, rows: [] };
    },
  });

  const saved = await repo.assignSection("tenant-1", {
    studentProfileId: "student-profile-1",
    courseSectionId: "section-1",
  });

  assert.equal(saved.id, "registration-1");
  assert.equal(calls.filter((call) => call.sql.includes("insert into academy_course_section_registrations")).length, 0);
});

test("student section enrollment API route uses request-scoped database context", async () => {
  const route = await readFile(
    path.join(process.cwd(), "src/app/api/academy/students/[id]/section-enrollments/route.ts"),
    "utf8",
  );

  assert.match(route, /resolveAcademyActorFromSession/);
  assert.match(route, /withAcademyDatabaseContext/);
  assert.match(route, /StudentSectionEnrollmentService/);
  assert.doesNotMatch(route, /getDatabasePool/);
});

test("student detail page exposes staff section enrollment", async () => {
  const page = await readFile(
    path.join(process.cwd(), "src/app/admin/students/[id]/page.tsx"),
    "utf8",
  );

  assert.match(page, /StudentSectionEnrollmentDialog/);
  assert.match(page, /availableSectionOptions/);
  assert.match(page, /section-enrollments/);
});
