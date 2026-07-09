import { getDatabasePool } from "@/lib/database";
import type {
  SetActiveStudentProgramMembershipInput,
  StudentProgramMembership,
  StudentProgramMembershipRepository,
} from "./types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface StudentProgramMembershipDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function dateString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function timestampString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapRow(row: Record<string, unknown>): StudentProgramMembership {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentProfileId: String(row.student_profile_id),
    studentPersonId: String(row.student_person_id),
    academicProgramId: String(row.academic_program_id),
    programCode: row.program_code != null ? String(row.program_code) : undefined,
    programTitle: row.program_title != null ? String(row.program_title) : undefined,
    catalogAcademicYearId: String(row.catalog_academic_year_id),
    catalogAcademicYearName: row.catalog_academic_year_name != null ? String(row.catalog_academic_year_name) : undefined,
    sourceApplicationId: row.source_application_id != null ? String(row.source_application_id) : undefined,
    status: String(row.status) as StudentProgramMembership["status"],
    startedOn: dateString(row.started_on) ?? "",
    endedOn: dateString(row.ended_on),
    createdAt: timestampString(row.created_at),
    updatedAt: timestampString(row.updated_at),
  };
}

const SELECT_SQL = `
  select m.id, m.tenant_id, m.student_profile_id, m.student_person_id,
         m.academic_program_id, p.program_code, p.title as program_title,
         m.catalog_academic_year_id, y.name as catalog_academic_year_name,
         m.source_application_id, m.status, m.started_on, m.ended_on,
         m.created_at, m.updated_at
    from academy_program_enrollments m
    left join academy_academic_programs p
      on p.tenant_id = m.tenant_id and p.id = m.academic_program_id
    left join academy_academic_years y
      on y.tenant_id = m.tenant_id and y.id = m.catalog_academic_year_id
`;

export class PostgresStudentProgramMembershipRepository implements StudentProgramMembershipRepository {
  constructor(
    private readonly database: StudentProgramMembershipDatabase = getDatabasePool() as StudentProgramMembershipDatabase,
  ) {}

  async listByStudent(tenantId: string, studentProfileId: string): Promise<StudentProgramMembership[]> {
    const result = await this.database.query(
      `${SELECT_SQL}
        where m.tenant_id = $1 and m.student_profile_id = $2
        order by
          case m.status when 'active' then 0 when 'completed' then 1 else 2 end,
          m.started_on desc,
          m.created_at desc`,
      [tenantId, studentProfileId],
    );
    return result.rows.map(mapRow);
  }

  async setActive(
    tenantId: string,
    input: Required<SetActiveStudentProgramMembershipInput>,
  ): Promise<StudentProgramMembership> {
    const student = await this.database.query(
      `select id, person_id from academy_student_profiles
        where tenant_id = $1 and id = $2
        limit 1`,
      [tenantId, input.studentProfileId],
    );
    const studentRow = student.rows[0];
    if (!studentRow) throw new Error("Student profile was not found.");

    const program = await this.database.query(
      `select ap.id, legacy.id as legacy_program_id
         from academy_academic_programs ap
         left join academy_programs legacy
           on legacy.tenant_id = ap.tenant_id
          and legacy.academic_program_id = ap.id
        where ap.tenant_id = $1
          and ap.id = $2
          and ap.status != 'archived'
        limit 1`,
      [tenantId, input.academicProgramId],
    );
    const programRow = program.rows[0];
    if (!programRow) throw new Error("Academic program was not found.");
    if (!programRow.legacy_program_id) {
      throw new Error("Compatible legacy program was not found.");
    }

    const year = await this.database.query(
      `select id from academy_academic_years
        where tenant_id = $1 and id = $2
        limit 1`,
      [tenantId, input.catalogAcademicYearId],
    );
    if (!year.rows[0]) throw new Error("Academic year was not found.");

    await this.database.query(
      `update academy_program_enrollments
          set status = 'withdrawn',
              ended_on = coalesce(ended_on, current_date),
              updated_at = now()
        where tenant_id = $1
          and student_profile_id = $2
          and status = 'active'`,
      [tenantId, input.studentProfileId],
    );

    const inserted = await this.database.query(
      `insert into academy_program_enrollments (
         tenant_id, student_profile_id, student_person_id,
         academic_program_id, catalog_academic_year_id,
         source_application_id, status, started_on
       ) values ($1,$2,$3,$4,$5,null,'active',$6)
       returning id, tenant_id, student_profile_id, student_person_id,
                 academic_program_id, null as program_code, null as program_title,
                 catalog_academic_year_id, null as catalog_academic_year_name,
                 source_application_id, status, started_on, ended_on,
                 created_at, updated_at`,
      [
        tenantId,
        input.studentProfileId,
        String(studentRow.person_id),
        input.academicProgramId,
        input.catalogAcademicYearId,
        input.startedOn,
      ],
    );

    await this.database.query(
      `update academy_student_profiles
          set program_id = $3,
              updated_at = now()
        where tenant_id = $1 and id = $2`,
      [tenantId, input.studentProfileId, String(programRow.legacy_program_id)],
    );

    const active = inserted.rows[0];
    if (!active) throw new Error("Program membership was not created.");
    return mapRow(active);
  }
}
