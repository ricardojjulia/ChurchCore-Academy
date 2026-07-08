import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { ProgramCurriculumService } from "../service";
import { PostgresProgramCurriculumRepository } from "../postgres-repository";
import type { ProgramCurriculumRequirement } from "../types";
import type { AcademyActor } from "@/modules/academy-auth/policy";

const adminActor: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const studentActor: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

function requirement(overrides: Partial<ProgramCurriculumRequirement> = {}): ProgramCurriculumRequirement {
  return {
    id: "req-1",
    tenantId: "tenant-1",
    academicProgramId: "11111111-1111-4111-8111-111111111111",
    academicYearId: "year-2026",
    courseId: "course-bib-101",
    courseCode: "BIB101",
    courseTitle: "Biblical Interpretation",
    requirementType: "required",
    requirementGroup: "core",
    sequence: 1,
    credits: 3,
    minimumGrade: "C",
    notes: "First-year sequence.",
    status: "active",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

test("program curriculum migration creates year-versioned requirements with tenant FKs", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260708010000_program_curriculum_requirements.sql"),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.academy_program_curriculum_requirements/i);
  assert.match(sql, /create unique index if not exists academy_academic_years_tenant_id_idx/i);
  assert.match(sql, /academic_program_id uuid not null/i);
  assert.match(sql, /academic_year_id text not null/i);
  assert.match(sql, /course_id text not null/i);
  assert.match(sql, /unique \(tenant_id, academic_program_id, academic_year_id, course_id\)/i);
  assert.match(sql, /references public\.academy_academic_programs\(id\)/i);
  assert.match(sql, /foreign key \(tenant_id, academic_year_id\)[\s\S]*academy_academic_years \(tenant_id, id\)/i);
  assert.match(sql, /foreign key \(tenant_id, course_id\)[\s\S]*academy_courses \(tenant_id, id\)/i);
  assert.match(sql, /enable row level security/i);
});

test("service rejects non-admin curriculum writes", async () => {
  const service = new ProgramCurriculumService({
    listRequirements: async () => [],
    replaceRequirements: async () => [],
  });

  await assert.rejects(
    () =>
      service.replaceCurriculum(studentActor, {
        academicProgramId: "11111111-1111-4111-8111-111111111111",
        academicYearId: "year-2026",
        requirements: [],
      }),
    { name: "AcademyAuthorizationError" },
  );
});

test("service rejects duplicate required courses in a catalog year", async () => {
  const service = new ProgramCurriculumService({
    listRequirements: async () => [],
    replaceRequirements: async () => [],
  });

  await assert.rejects(
    () =>
      service.replaceCurriculum(adminActor, {
        academicProgramId: "11111111-1111-4111-8111-111111111111",
        academicYearId: "year-2026",
        requirements: [
          { courseId: "course-bib-101", requirementType: "required", requirementGroup: "core", sequence: 1, credits: 3 },
          { courseId: "course-bib-101", requirementType: "required", requirementGroup: "core", sequence: 2, credits: 3 },
        ],
      }),
    /course can appear only once/,
  );
});

test("service saves normalized curriculum requirements", async () => {
  let captured: unknown;
  const service = new ProgramCurriculumService({
    listRequirements: async () => [],
    replaceRequirements: async (_tenantId, academicProgramId, academicYearId, requirements) => {
      captured = { academicProgramId, academicYearId, requirements };
      return [requirement({ courseId: requirements[0]!.courseId })];
    },
  });

  const saved = await service.replaceCurriculum(adminActor, {
    academicProgramId: "11111111-1111-4111-8111-111111111111",
    academicYearId: "year-2026",
    requirements: [
      { courseId: " course-bib-101 ", requirementType: "required", requirementGroup: " core ", sequence: 1, credits: 3 },
    ],
  });

  assert.equal(saved[0]?.courseId, "course-bib-101");
  assert.deepEqual(captured, {
    academicProgramId: "11111111-1111-4111-8111-111111111111",
    academicYearId: "year-2026",
    requirements: [
      { courseId: "course-bib-101", requirementType: "required", requirementGroup: "core", sequence: 1, credits: 3 },
    ],
  });
});

test("repository replace deletes one program-year and inserts ordered requirements", async () => {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const repo = new PostgresProgramCurriculumRepository({
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("from academy_academic_programs")) return { rowCount: 1, rows: [{ id: "program" }] };
      if (sql.includes("from academy_academic_years")) return { rowCount: 1, rows: [{ id: "year" }] };
      if (sql.includes("from academy_courses") && sql.includes("where tenant_id = $1 and id = any")) {
        return { rowCount: 2, rows: [{ id: "course-bib-101" }, { id: "course-bib-102" }] };
      }
      if (sql.includes("insert into academy_program_curriculum_requirements")) {
        return { rowCount: 1, rows: [requirement({ id: `req-${calls.length}`, courseId: String(values?.[3]) })] };
      }
      return { rowCount: 1, rows: [] };
    },
  });

  const saved = await repo.replaceRequirements("tenant-1", "11111111-1111-4111-8111-111111111111", "year-2026", [
    { courseId: "course-bib-102", requirementType: "required", requirementGroup: "core", sequence: 2, credits: 3 },
    { courseId: "course-bib-101", requirementType: "required", requirementGroup: "core", sequence: 1, credits: 3 },
  ]);

  assert.equal(saved.length, 2);
  assert.ok(calls.some((call) => call.sql.includes("delete from academy_program_curriculum_requirements")));
  const insertCalls = calls.filter((call) => call.sql.includes("insert into academy_program_curriculum_requirements"));
  assert.equal(insertCalls.length, 2);
  assert.equal(insertCalls[0]?.values?.[3], "course-bib-101");
  assert.equal(insertCalls[1]?.values?.[3], "course-bib-102");
});

test("program curriculum API route uses request-scoped database context", async () => {
  const route = await readFile(
    path.join(process.cwd(), "src/app/api/academy/programs/[id]/curriculum/route.ts"),
    "utf8",
  );

  assert.match(route, /resolveAcademyActorFromSession/);
  assert.match(route, /withAcademyDatabaseContext/);
  assert.match(route, /ProgramCurriculumService/);
  assert.doesNotMatch(route, /getDatabasePool/);
});
