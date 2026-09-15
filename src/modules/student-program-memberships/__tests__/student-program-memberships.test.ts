import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { PostgresStudentProgramMembershipRepository } from "../postgres-repository";
import { StudentProgramMembershipService } from "../service";
import type { StudentProgramMembership } from "../types";

const adminActor: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["registrar"],
};

const studentActor: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
};

function membership(overrides: Partial<StudentProgramMembership> = {}): StudentProgramMembership {
  return {
    id: "membership-1",
    tenantId: "tenant-1",
    studentProfileId: "student-profile-1",
    studentPersonId: "person-student-1",
    academicProgramId: "11111111-1111-4111-8111-111111111111",
    programCode: "BIB",
    programTitle: "Biblical Studies",
    catalogAcademicYearId: "year-2026",
    catalogAcademicYearName: "2026-2027",
    status: "active",
    startedOn: "2026-08-15",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

function membershipRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "membership-1",
    tenant_id: "tenant-1",
    student_profile_id: "student-profile-1",
    student_person_id: "person-student-1",
    academic_program_id: "11111111-1111-4111-8111-111111111111",
    program_code: "BIB",
    program_title: "Biblical Studies",
    catalog_academic_year_id: "year-2026",
    catalog_academic_year_name: "2026-2027",
    source_application_id: null,
    status: "active",
    started_on: "2026-08-15",
    ended_on: null,
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

test("student program membership migration links catalog year and permits manual assignment", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260708020000_student_program_memberships.sql"),
    "utf8",
  );

  assert.match(sql, /alter table public\.academy_program_enrollments[\s\S]*alter column source_application_id drop not null/i);
  assert.match(sql, /add column if not exists catalog_academic_year_id text/i);
  assert.match(sql, /foreign key \(tenant_id, catalog_academic_year_id\)[\s\S]*academy_academic_years \(tenant_id, id\)/i);
  assert.match(sql, /academy_program_enrollments_one_active_student_idx/i);
  assert.match(sql, /where status = 'active'/i);
});

test("service rejects non-admin membership writes", async () => {
  const service = new StudentProgramMembershipService({
    listByStudent: async () => [],
    setActive: async () => membership(),
  });

  await assert.rejects(
    () =>
      service.setActiveMembership(studentActor, {
        studentProfileId: "student-profile-1",
        academicProgramId: "11111111-1111-4111-8111-111111111111",
        catalogAcademicYearId: "year-2026",
      }),
    { name: "AcademyAuthorizationError" },
  );
});

test("service normalizes active membership input", async () => {
  let captured: unknown;
  const service = new StudentProgramMembershipService({
    listByStudent: async () => [],
    setActive: async (_tenantId, input) => {
      captured = input;
      return membership({ startedOn: input.startedOn });
    },
  });

  const result = await service.setActiveMembership(adminActor, {
    studentProfileId: " student-profile-1 ",
    academicProgramId: " 11111111-1111-4111-8111-111111111111 ",
    catalogAcademicYearId: " year-2026 ",
    startedOn: "2026-08-20",
  });

  assert.equal(result.startedOn, "2026-08-20");
  assert.deepEqual(captured, {
    studentProfileId: "student-profile-1",
    academicProgramId: "11111111-1111-4111-8111-111111111111",
    catalogAcademicYearId: "year-2026",
    startedOn: "2026-08-20",
  });
});

test("repository replaces active membership and syncs legacy student profile program", async () => {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const repo = new PostgresStudentProgramMembershipRepository({
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("from academy_student_profiles")) {
        return { rowCount: 1, rows: [{ id: "student-profile-1", person_id: "person-student-1" }] };
      }
      if (sql.includes("from academy_academic_programs") && sql.includes("legacy.id")) {
        return {
          rowCount: 1,
          rows: [{
            id: "11111111-1111-4111-8111-111111111111",
            legacy_program_id: "legacy-program-1",
          }],
        };
      }
      if (sql.includes("from academy_academic_years")) {
        return { rowCount: 1, rows: [{ id: "year-2026" }] };
      }
      if (sql.includes("insert into academy_program_enrollments")) {
        return { rowCount: 1, rows: [membershipRow()] };
      }
      return { rowCount: 1, rows: [] };
    },
  });

  const saved = await repo.setActive("tenant-1", {
    studentProfileId: "student-profile-1",
    academicProgramId: "11111111-1111-4111-8111-111111111111",
    catalogAcademicYearId: "year-2026",
    startedOn: "2026-08-15",
  });

  assert.equal(saved.academicProgramId, "11111111-1111-4111-8111-111111111111");
  assert.ok(calls.some((call) => call.sql.includes("status = 'withdrawn'")));
  assert.ok(calls.some((call) => call.sql.includes("insert into academy_program_enrollments")));
  const profileSync = calls.find((call) => call.sql.includes("update academy_student_profiles"));
  assert.ok(profileSync);
  assert.deepEqual(profileSync.values, ["tenant-1", "student-profile-1", "legacy-program-1"]);
});

test("student program membership API route uses request-scoped database context", async () => {
  const route = await readFile(
    path.join(process.cwd(), "src/app/api/academy/students/[id]/program-membership/route.ts"),
    "utf8",
  );

  assert.match(route, /resolveAcademyActorFromSession/);
  assert.match(route, /withAcademyDatabaseContext/);
  assert.match(route, /StudentProgramMembershipService/);
  assert.doesNotMatch(route, /getDatabasePool/);
});

test("student detail page exposes program membership assignment", async () => {
  const page = await readFile(
    path.join(process.cwd(), "src/app/admin/students/[id]/page.tsx"),
    "utf8",
  );

  assert.match(page, /StudentProgramMembershipDialog/);
  assert.match(page, /programMemberships/);
  assert.match(page, /academicProgramOptions/);
  assert.match(page, /academicYearOptions/);
  assert.match(page, /student_person_id = \$2[\s\S]*personId/);
});
