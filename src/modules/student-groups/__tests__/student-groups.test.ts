import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { PostgresStudentGroupRepository } from "../postgres-repository";
import { StudentGroupService } from "../service";
import type { StudentGroup } from "../types";

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

function group(overrides: Partial<StudentGroup> = {}): StudentGroup {
  return {
    id: "group-1",
    tenantId: "tenant-1",
    academicYearId: "year-2026",
    academicYearName: "2026-2027",
    academicProgramId: "11111111-1111-4111-8111-111111111111",
    programCode: "BIB",
    programTitle: "Biblical Studies",
    name: "Fall 2026 Biblical Studies",
    code: "BIB-2026",
    groupType: "program_cohort",
    status: "active",
    description: "Fall intake",
    memberCount: 0,
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
    ...overrides,
  };
}

test("migration creates tenant-scoped groups and dated unique memberships", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260709132902_student_groups.sql"),
    "utf8",
  );

  assert.match(sql, /create table.*academy_student_groups/is);
  assert.match(sql, /unique index.*academy_academic_programs.*tenant_id.*id/is);
  assert.match(sql, /group_type.*cohort.*graduating_class.*program_cohort/is);
  assert.match(sql, /foreign key \(tenant_id, academic_year_id\)/i);
  assert.match(sql, /foreign key \(tenant_id, academic_program_id\)/i);
  assert.match(sql, /create table.*academy_student_group_memberships/is);
  assert.match(sql, /academy_student_group_memberships_one_active_idx/i);
  assert.match(sql, /where ended_on is null/i);
  assert.match(sql, /enable row level security/gi);
  assert.match(sql, /current_setting\('app\.academy_tenant_id'/i);
});

test("service rejects student group access for non-administrators", async () => {
  const service = new StudentGroupService({
    listGroups: async () => [],
    createGroup: async () => group(),
    updateGroup: async () => group(),
    listMembers: async () => [],
    listByStudent: async () => [],
    addMember: async () => {
      throw new Error("not used");
    },
    removeMember: async () => undefined,
  });

  await assert.rejects(() => service.listGroups(studentActor), {
    name: "AcademyAuthorizationError",
  });
});

test("service normalizes a program cohort and requires its program", async () => {
  let captured: unknown;
  const service = new StudentGroupService({
    listGroups: async () => [],
    createGroup: async (_tenantId, input) => {
      captured = input;
      return group();
    },
    updateGroup: async () => group(),
    listMembers: async () => [],
    listByStudent: async () => [],
    addMember: async () => {
      throw new Error("not used");
    },
    removeMember: async () => undefined,
  });

  await assert.rejects(
    () => service.createGroup(adminActor, {
      name: "Fall Cohort",
      code: "fall-2026",
      groupType: "program_cohort",
      academicYearId: "year-2026",
    }),
    /academicProgramId is required/i,
  );

  await service.createGroup(adminActor, {
    name: " Fall Cohort ",
    code: " fall-2026 ",
    groupType: "program_cohort",
    academicYearId: " year-2026 ",
    academicProgramId: " 11111111-1111-4111-8111-111111111111 ",
    description: " Fall intake ",
  });

  assert.deepEqual(captured, {
    name: "Fall Cohort",
    code: "FALL-2026",
    groupType: "program_cohort",
    academicYearId: "year-2026",
    academicProgramId: "11111111-1111-4111-8111-111111111111",
    description: "Fall intake",
  });
});

test("repository validates references and inserts a tenant-scoped group", async () => {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const repository = new PostgresStudentGroupRepository({
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("from academy_academic_years")) {
        return { rowCount: 1, rows: [{ id: "year-2026" }] };
      }
      if (sql.includes("from academy_academic_programs")) {
        return { rowCount: 1, rows: [{ id: "11111111-1111-4111-8111-111111111111" }] };
      }
      if (sql.includes("insert into academy_student_groups")) {
        return {
          rowCount: 1,
          rows: [{
            id: "group-1",
            tenant_id: "tenant-1",
            academic_year_id: "year-2026",
            academic_year_name: "2026-2027",
            academic_program_id: "11111111-1111-4111-8111-111111111111",
            program_code: "BIB",
            program_title: "Biblical Studies",
            name: "Fall Cohort",
            code: "FALL-2026",
            group_type: "program_cohort",
            status: "active",
            description: null,
            member_count: "0",
            created_at: "2026-07-09T00:00:00.000Z",
            updated_at: "2026-07-09T00:00:00.000Z",
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    },
  });

  const saved = await repository.createGroup("tenant-1", {
    name: "Fall Cohort",
    code: "FALL-2026",
    groupType: "program_cohort",
    academicYearId: "year-2026",
    academicProgramId: "11111111-1111-4111-8111-111111111111",
  });

  assert.equal(saved.code, "FALL-2026");
  assert.ok(calls.some((call) => call.sql.includes("insert into academy_student_groups")));
  assert.ok(calls.every((call) => call.values?.[0] === "tenant-1"));
});

test("repository group list includes academic-year ordering in the aggregate grouping", async () => {
  let capturedSql = "";
  const repository = new PostgresStudentGroupRepository({
    async query(sql) {
      capturedSql = sql;
      return { rowCount: 0, rows: [] };
    },
  });

  await repository.listGroups("tenant-1");

  assert.match(capturedSql, /group by[\s\S]*y\.starts_on[\s\S]*order by[\s\S]*y\.starts_on/i);
});

test("repository ends membership instead of deleting history", async () => {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const repository = new PostgresStudentGroupRepository({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rowCount: 1, rows: [] };
    },
  });

  await repository.removeMember("tenant-1", "group-1", "membership-1", "person-admin");

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /update academy_student_group_memberships/i);
  assert.match(calls[0].sql, /ended_on = current_date/i);
  assert.doesNotMatch(calls[0].sql, /delete from/i);
});

test("student group APIs use request-scoped database context", async () => {
  const files = [
    "src/app/api/academy/student-groups/route.ts",
    "src/app/api/academy/student-groups/[id]/route.ts",
    "src/app/api/academy/student-groups/[id]/members/route.ts",
    "src/app/api/academy/student-groups/[id]/members/[membershipId]/route.ts",
  ];

  for (const file of files) {
    const source = await readFile(path.join(process.cwd(), file), "utf8");
    assert.match(source, /resolveAcademyActorFromSession/);
    assert.match(source, /withAcademyDatabaseContext/);
    assert.doesNotMatch(source, /getDatabasePool/);
  }
});

test("admin navigation and student record expose student groups", async () => {
  const [shell, page, client, studentPage] = await Promise.all([
    readFile(path.join(process.cwd(), "src/components/admin-shell.tsx"), "utf8"),
    readFile(path.join(process.cwd(), "src/app/admin/groups/page.tsx"), "utf8"),
    readFile(path.join(process.cwd(), "src/app/admin/groups/StudentGroupsClient.tsx"), "utf8"),
    readFile(path.join(process.cwd(), "src/app/admin/students/[id]/page.tsx"), "utf8"),
  ]);

  assert.match(shell, /Student Groups/);
  assert.match(shell, /\/admin\/groups/);
  assert.match(page, /StudentGroupsClient/);
  assert.doesNotMatch(page, /Promise\.all/);
  assert.match(client, /Create group/);
  assert.match(client, /Add student/);
  assert.match(studentPage, /StudentGroupsCard/);
  assert.match(studentPage, /studentGroupMemberships/);
});
