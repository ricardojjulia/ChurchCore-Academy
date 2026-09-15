import { getDatabasePool } from "@/lib/database";
import type {
  AddStudentGroupMemberInput,
  CreateStudentGroupInput,
  StudentGroup,
  StudentGroupMembership,
  StudentGroupRepository,
  UpdateStudentGroupInput,
} from "./types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface StudentGroupDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function timestamp(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function date(value: unknown): string | undefined {
  if (value == null) return undefined;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function mapGroup(row: Record<string, unknown>): StudentGroup {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    academicYearId: String(row.academic_year_id),
    academicYearName: row.academic_year_name != null ? String(row.academic_year_name) : undefined,
    academicProgramId: row.academic_program_id != null ? String(row.academic_program_id) : undefined,
    programCode: row.program_code != null ? String(row.program_code) : undefined,
    programTitle: row.program_title != null ? String(row.program_title) : undefined,
    name: String(row.name),
    code: String(row.code),
    groupType: String(row.group_type) as StudentGroup["groupType"],
    status: String(row.status) as StudentGroup["status"],
    description: row.description != null ? String(row.description) : undefined,
    memberCount: Number(row.member_count ?? 0),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

function mapMembership(row: Record<string, unknown>): StudentGroupMembership {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentGroupId: String(row.student_group_id),
    groupName: row.group_name != null ? String(row.group_name) : undefined,
    groupCode: row.group_code != null ? String(row.group_code) : undefined,
    groupType: row.group_type != null ? String(row.group_type) as StudentGroupMembership["groupType"] : undefined,
    groupStatus: row.group_status != null ? String(row.group_status) as StudentGroupMembership["groupStatus"] : undefined,
    academicYearId: row.academic_year_id != null ? String(row.academic_year_id) : undefined,
    academicYearName: row.academic_year_name != null ? String(row.academic_year_name) : undefined,
    academicProgramId: row.academic_program_id != null ? String(row.academic_program_id) : undefined,
    programTitle: row.program_title != null ? String(row.program_title) : undefined,
    studentProfileId: String(row.student_profile_id),
    studentPersonId: String(row.student_person_id),
    studentName: row.student_name != null ? String(row.student_name) : undefined,
    studentNumber: row.student_number != null ? String(row.student_number) : undefined,
    startedOn: date(row.started_on) ?? "",
    endedOn: date(row.ended_on),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

const GROUP_SELECT = `
  select g.id, g.tenant_id, g.academic_year_id, y.name as academic_year_name,
         g.academic_program_id, p.program_code, p.title as program_title,
         g.name, g.code, g.group_type, g.status, g.description,
         count(m.id) filter (where m.ended_on is null) as member_count,
         g.created_at, g.updated_at
    from academy_student_groups g
    join academy_academic_years y
      on y.tenant_id = g.tenant_id and y.id = g.academic_year_id
    left join academy_academic_programs p
      on p.tenant_id = g.tenant_id and p.id = g.academic_program_id
    left join academy_student_group_memberships m
      on m.tenant_id = g.tenant_id and m.student_group_id = g.id
`;

const MEMBERSHIP_SELECT = `
  select m.id, m.tenant_id, m.student_group_id,
         g.name as group_name, g.code as group_code, g.group_type, g.status as group_status,
         g.academic_year_id, y.name as academic_year_name,
         g.academic_program_id, p.title as program_title,
         m.student_profile_id, m.student_person_id,
         person.display_name as student_name, student.student_number,
         m.started_on, m.ended_on, m.created_at, m.updated_at
    from academy_student_group_memberships m
    join academy_student_groups g
      on g.tenant_id = m.tenant_id and g.id = m.student_group_id
    join academy_academic_years y
      on y.tenant_id = g.tenant_id and y.id = g.academic_year_id
    left join academy_academic_programs p
      on p.tenant_id = g.tenant_id and p.id = g.academic_program_id
    join academy_student_profiles student
      on student.tenant_id = m.tenant_id and student.id = m.student_profile_id
    join academy_people person
      on person.tenant_id = m.tenant_id and person.id = m.student_person_id
`;

const GROUP_BY = `
  group by g.id, g.tenant_id, g.academic_year_id, y.name, y.starts_on,
           g.academic_program_id, p.program_code, p.title,
           g.name, g.code, g.group_type, g.status, g.description,
           g.created_at, g.updated_at
`;

export class PostgresStudentGroupRepository implements StudentGroupRepository {
  constructor(private readonly database: StudentGroupDatabase = getDatabasePool() as StudentGroupDatabase) {}

  async listGroups(tenantId: string): Promise<StudentGroup[]> {
    const result = await this.database.query(
      `${GROUP_SELECT} where g.tenant_id = $1 ${GROUP_BY}
       order by case g.status when 'active' then 0 else 1 end, y.starts_on desc, g.name`,
      [tenantId],
    );
    return result.rows.map(mapGroup);
  }

  private async validateReferences(
    tenantId: string,
    academicYearId: string,
    academicProgramId?: string,
  ) {
    const year = await this.database.query(
      `select id from academy_academic_years where tenant_id = $1 and id = $2 limit 1`,
      [tenantId, academicYearId],
    );
    if (!year.rows[0]) throw new Error("Academic year was not found.");
    if (academicProgramId) {
      const program = await this.database.query(
        `select id from academy_academic_programs
          where tenant_id = $1 and id = $2 and status != 'archived' limit 1`,
        [tenantId, academicProgramId],
      );
      if (!program.rows[0]) throw new Error("Academic program was not found.");
    }
  }

  async createGroup(
    tenantId: string,
    input: CreateStudentGroupInput,
    actorPersonId = "person-admin",
  ): Promise<StudentGroup> {
    await this.validateReferences(tenantId, input.academicYearId, input.academicProgramId);
    const result = await this.database.query(
      `with inserted as (
         insert into academy_student_groups (
           tenant_id, academic_year_id, academic_program_id, name, code,
           group_type, status, description, created_by_person_id
         ) values ($1,$2,$3,$4,$5,$6,'active',$7,$8)
         returning *
       )
       select inserted.*, y.name as academic_year_name,
              p.program_code, p.title as program_title, 0 as member_count
         from inserted
         join academy_academic_years y
           on y.tenant_id = inserted.tenant_id and y.id = inserted.academic_year_id
         left join academy_academic_programs p
           on p.tenant_id = inserted.tenant_id and p.id = inserted.academic_program_id`,
      [
        tenantId, input.academicYearId, input.academicProgramId ?? null, input.name,
        input.code, input.groupType, input.description ?? null, actorPersonId,
      ],
    );
    if (!result.rows[0]) throw new Error("Student group was not created.");
    return mapGroup(result.rows[0]);
  }

  async updateGroup(tenantId: string, groupId: string, input: UpdateStudentGroupInput): Promise<StudentGroup> {
    await this.validateReferences(tenantId, input.academicYearId, input.academicProgramId);
    const result = await this.database.query(
      `update academy_student_groups
          set academic_year_id = $3, academic_program_id = $4, name = $5,
              code = $6, group_type = $7, status = $8, description = $9, updated_at = now()
        where tenant_id = $1 and id = $2
        returning id`,
      [
        tenantId, groupId, input.academicYearId, input.academicProgramId ?? null,
        input.name, input.code, input.groupType, input.status, input.description ?? null,
      ],
    );
    if (!result.rows[0]) throw new Error("Student group was not found.");
    const groups = await this.database.query(
      `${GROUP_SELECT} where g.tenant_id = $1 and g.id = $2 ${GROUP_BY}`,
      [tenantId, groupId],
    );
    if (!groups.rows[0]) throw new Error("Student group was not found.");
    return mapGroup(groups.rows[0]);
  }

  async listMembers(tenantId: string, groupId: string): Promise<StudentGroupMembership[]> {
    const result = await this.database.query(
      `${MEMBERSHIP_SELECT}
        where m.tenant_id = $1 and m.student_group_id = $2
        order by case when m.ended_on is null then 0 else 1 end, person.display_name`,
      [tenantId, groupId],
    );
    return result.rows.map(mapMembership);
  }

  async listByStudent(tenantId: string, studentProfileId: string): Promise<StudentGroupMembership[]> {
    const result = await this.database.query(
      `${MEMBERSHIP_SELECT}
        where m.tenant_id = $1 and m.student_profile_id = $2
        order by case when m.ended_on is null then 0 else 1 end, m.started_on desc`,
      [tenantId, studentProfileId],
    );
    return result.rows.map(mapMembership);
  }

  async addMember(
    tenantId: string,
    groupId: string,
    input: Required<AddStudentGroupMemberInput>,
    actorPersonId: string,
  ): Promise<StudentGroupMembership> {
    const group = await this.database.query(
      `select id from academy_student_groups
        where tenant_id = $1 and id = $2 and status = 'active' limit 1`,
      [tenantId, groupId],
    );
    if (!group.rows[0]) throw new Error("Active student group was not found.");
    const student = await this.database.query(
      `select id, person_id from academy_student_profiles
        where tenant_id = $1 and id = $2 limit 1`,
      [tenantId, input.studentProfileId],
    );
    if (!student.rows[0]) throw new Error("Student profile was not found.");
    const result = await this.database.query(
      `insert into academy_student_group_memberships (
         tenant_id, student_group_id, student_profile_id, student_person_id,
         started_on, added_by_person_id
       ) values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [tenantId, groupId, input.studentProfileId, String(student.rows[0].person_id), input.startedOn, actorPersonId],
    );
    if (!result.rows[0]) throw new Error("Student group membership was not created.");
    const memberships = await this.listMembers(tenantId, groupId);
    const membership = memberships.find((item) => item.id === String(result.rows[0].id));
    if (!membership) throw new Error("Student group membership was not found.");
    return membership;
  }

  async removeMember(
    tenantId: string,
    groupId: string,
    membershipId: string,
    actorPersonId: string,
  ): Promise<void> {
    const result = await this.database.query(
      `update academy_student_group_memberships
          set ended_on = current_date, ended_by_person_id = $4, updated_at = now()
        where tenant_id = $1 and student_group_id = $2 and id = $3 and ended_on is null`,
      [tenantId, groupId, membershipId, actorPersonId],
    );
    if (!result.rowCount) throw new Error("Active student group membership was not found.");
  }
}
