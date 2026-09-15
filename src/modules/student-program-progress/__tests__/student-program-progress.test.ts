import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { PostgresStudentProgramProgressRepository } from "../postgres-repository";
import { StudentProgramProgressService } from "../service";
import type { StudentProgramProgressSummary } from "../types";

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

function progress(overrides: Partial<StudentProgramProgressSummary> = {}): StudentProgramProgressSummary {
  return {
    studentProfileId: "student-profile-1",
    activeProgramMembershipId: "program-enrollment-1",
    academicProgramId: "academic-program-1",
    programCode: "ML",
    programTitle: "Ministry Leadership",
    catalogAcademicYearId: "year-2026",
    catalogAcademicYearName: "2026-2027",
    requiredCredits: 6,
    completedCredits: 3,
    inProgressCredits: 3,
    remainingCredits: 3,
    percentComplete: 50,
    requirements: [],
    ...overrides,
  };
}

function progressRow(overrides: Record<string, unknown> = {}) {
  return {
    active_program_membership_id: "program-enrollment-1",
    student_profile_id: "student-profile-1",
    academic_program_id: "academic-program-1",
    program_code: "ML",
    program_title: "Ministry Leadership",
    catalog_academic_year_id: "year-2026",
    catalog_academic_year_name: "2026-2027",
    requirement_id: "requirement-1",
    course_id: "course-1",
    course_code: "ML-101",
    course_title: "Foundations",
    requirement_type: "required",
    requirement_group: "core",
    sequence: 1,
    credits: "3",
    minimum_grade: "C",
    completed_registration_id: null,
    active_registration_id: null,
    completed_at: null,
    final_letter_grade: null,
    progress_status: "not_started",
    ...overrides,
  };
}

test("service rejects student actors reading staff progress view", async () => {
  const service = new StudentProgramProgressService({
    getProgress: async () => progress(),
  });

  await assert.rejects(
    () => service.getProgress(student, "student-profile-1"),
    { name: "AcademyAuthorizationError" },
  );
});

test("service normalizes staff progress read input", async () => {
  let captured: unknown;
  const service = new StudentProgramProgressService({
    getProgress: async (_tenantId, studentProfileId) => {
      captured = studentProfileId;
      return progress();
    },
  });

  await service.getProgress(registrar, " student-profile-1 ");

  assert.equal(captured, "student-profile-1");
});

test("repository maps curriculum progress credits and statuses", async () => {
  const repo = new PostgresStudentProgramProgressRepository({
    async query(sql, values) {
      assert.match(sql, /academy_program_curriculum_requirements/);
      assert.match(sql, /academy_course_section_registrations/);
      assert.match(sql, /academy_gradebook_course_summaries/);
      assert.deepEqual(values, ["tenant-1", "student-profile-1"]);
      return {
        rowCount: 3,
        rows: [
          progressRow({
            requirement_id: "requirement-1",
            course_id: "course-1",
            course_code: "ML-101",
            credits: "3",
            completed_registration_id: "registration-1",
            completed_at: "2026-12-15T00:00:00.000Z",
            final_letter_grade: "A",
            progress_status: "completed",
          }),
          progressRow({
            requirement_id: "requirement-2",
            course_id: "course-2",
            course_code: "ML-102",
            credits: "2",
            active_registration_id: "registration-2",
            progress_status: "in_progress",
          }),
          progressRow({
            requirement_id: "requirement-3",
            course_id: "course-3",
            course_code: "ML-103",
            credits: "1",
          }),
        ],
      };
    },
  });

  const saved = await repo.getProgress("tenant-1", "student-profile-1");

  assert.equal(saved?.requiredCredits, 6);
  assert.equal(saved?.completedCredits, 3);
  assert.equal(saved?.inProgressCredits, 2);
  assert.equal(saved?.remainingCredits, 3);
  assert.equal(saved?.percentComplete, 50);
  assert.deepEqual(saved?.requirements.map((item) => item.status), [
    "completed",
    "in_progress",
    "not_started",
  ]);
  assert.equal(saved?.requirements[0]?.finalLetterGrade, "A");
});

test("repository returns undefined when no active catalog membership has curriculum", async () => {
  const repo = new PostgresStudentProgramProgressRepository({
    async query() {
      return { rowCount: 0, rows: [] };
    },
  });

  assert.equal(await repo.getProgress("tenant-1", "student-profile-1"), undefined);
});

test("student program progress API route uses request-scoped database context", async () => {
  const route = await readFile(
    path.join(process.cwd(), "src/app/api/academy/students/[id]/program-progress/route.ts"),
    "utf8",
  );

  assert.match(route, /resolveAcademyActorFromSession/);
  assert.match(route, /withAcademyDatabaseContext/);
  assert.match(route, /StudentProgramProgressService/);
  assert.doesNotMatch(route, /getDatabasePool/);
});

test("student detail page exposes curriculum-based progress", async () => {
  const page = await readFile(
    path.join(process.cwd(), "src/app/admin/students/[id]/page.tsx"),
    "utf8",
  );

  assert.match(page, /StudentProgramProgressCard/);
  assert.match(page, /programProgress/);
  assert.doesNotMatch(page, /label="Transcript credits"/);
});
