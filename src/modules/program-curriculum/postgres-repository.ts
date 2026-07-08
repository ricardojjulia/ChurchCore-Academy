import { getDatabasePool } from "@/lib/database";
import type {
  ProgramCurriculumRepository,
  ProgramCurriculumRequirement,
  ProgramCurriculumRequirementInput,
} from "./types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface ProgramCurriculumDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function mapRow(row: Record<string, unknown>): ProgramCurriculumRequirement {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    academicProgramId: String(row.academic_program_id),
    academicYearId: String(row.academic_year_id),
    courseId: String(row.course_id),
    courseCode: row.course_code != null ? String(row.course_code) : undefined,
    courseTitle: row.course_title != null ? String(row.course_title) : undefined,
    requirementType: String(row.requirement_type) as ProgramCurriculumRequirement["requirementType"],
    requirementGroup: String(row.requirement_group),
    sequence: Number(row.sequence),
    credits: Number(row.credits),
    minimumGrade: row.minimum_grade != null ? String(row.minimum_grade) : undefined,
    notes: row.notes != null ? String(row.notes) : undefined,
    status: String(row.status) as ProgramCurriculumRequirement["status"],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

const SELECT_SQL = `
  select r.id, r.tenant_id, r.academic_program_id, r.academic_year_id,
         r.course_id, c.code as course_code, c.title as course_title,
         r.requirement_type, r.requirement_group, r.sequence, r.credits,
         r.minimum_grade, r.notes, r.status, r.created_at, r.updated_at
    from academy_program_curriculum_requirements r
    join academy_courses c
      on c.tenant_id = r.tenant_id and c.id = r.course_id
`;

export class PostgresProgramCurriculumRepository implements ProgramCurriculumRepository {
  constructor(
    private readonly database: ProgramCurriculumDatabase = getDatabasePool() as ProgramCurriculumDatabase,
  ) {}

  async listRequirements(
    tenantId: string,
    academicProgramId: string,
    academicYearId: string,
  ): Promise<ProgramCurriculumRequirement[]> {
    const result = await this.database.query(
      `${SELECT_SQL}
        where r.tenant_id = $1
          and r.academic_program_id = $2
          and r.academic_year_id = $3
          and r.status = 'active'
        order by r.sequence asc, c.code asc`,
      [tenantId, academicProgramId, academicYearId],
    );
    return result.rows.map(mapRow);
  }

  async replaceRequirements(
    tenantId: string,
    academicProgramId: string,
    academicYearId: string,
    requirements: ProgramCurriculumRequirementInput[],
  ): Promise<ProgramCurriculumRequirement[]> {
    await this.assertProgramYearAndCoursesExist(tenantId, academicProgramId, academicYearId, requirements);

    await this.database.query(
      `delete from academy_program_curriculum_requirements
        where tenant_id = $1 and academic_program_id = $2 and academic_year_id = $3`,
      [tenantId, academicProgramId, academicYearId],
    );

    const inserted: ProgramCurriculumRequirement[] = [];
    for (const requirement of [...requirements].sort((a, b) => a.sequence - b.sequence)) {
      const result = await this.database.query(
        `insert into academy_program_curriculum_requirements (
           tenant_id, academic_program_id, academic_year_id, course_id,
           requirement_type, requirement_group, sequence, credits,
           minimum_grade, notes, status
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')
         returning id, tenant_id, academic_program_id, academic_year_id,
                   course_id, null as course_code, null as course_title,
                   requirement_type, requirement_group, sequence, credits,
                   minimum_grade, notes, status, created_at, updated_at`,
        [
          tenantId,
          academicProgramId,
          academicYearId,
          requirement.courseId,
          requirement.requirementType,
          requirement.requirementGroup,
          requirement.sequence,
          requirement.credits,
          requirement.minimumGrade ?? null,
          requirement.notes ?? null,
        ],
      );
      if (result.rows[0]) inserted.push(mapRow(result.rows[0]));
    }

    if (inserted.length === 0) return [];

    const reloaded = await this.listRequirements(tenantId, academicProgramId, academicYearId);
    return reloaded.length > 0 ? reloaded : inserted;
  }

  private async assertProgramYearAndCoursesExist(
    tenantId: string,
    academicProgramId: string,
    academicYearId: string,
    requirements: ProgramCurriculumRequirementInput[],
  ) {
    const program = await this.database.query(
      `select id from academy_academic_programs where tenant_id = $1 and id = $2 limit 1`,
      [tenantId, academicProgramId],
    );
    if (!program.rows[0]) throw new Error("Program was not found.");

    const year = await this.database.query(
      `select id from academy_academic_years where tenant_id = $1 and id = $2 limit 1`,
      [tenantId, academicYearId],
    );
    if (!year.rows[0]) throw new Error("Academic year was not found.");

    const courseIds = requirements.map((requirement) => requirement.courseId);
    if (courseIds.length === 0) return;

    const courses = await this.database.query(
      `select id from academy_courses
        where tenant_id = $1 and id = any($2::text[]) and status != 'archived'`,
      [tenantId, courseIds],
    );
    if (courses.rows.length !== new Set(courseIds).size) {
      throw new Error("All curriculum courses must belong to this institution and be active or draft.");
    }
  }
}
