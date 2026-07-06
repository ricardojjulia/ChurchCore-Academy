import { getDatabasePool } from "@/lib/database";
import { AcademyConflictError } from "@/modules/academy-auth/errors";
import type {
  AcademicProgram,
  AcademicProgramRepository,
  CreateAcademicProgramInput,
  ProgramInstitutionMode,
  ProgramStatus,
  UpdateAcademicProgramInput,
} from "./types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface AcademicProgramDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function mapRow(row: Record<string, unknown>): AcademicProgram {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    programCode: String(row.program_code),
    title: String(row.title),
    shortTitle: row.short_title != null ? String(row.short_title) : undefined,
    description: row.description != null ? String(row.description) : undefined,
    institutionMode: String(row.institution_mode) as AcademicProgram["institutionMode"],
    credentialType: String(row.credential_type) as AcademicProgram["credentialType"],
    gradeBand: row.grade_band != null ? String(row.grade_band) as AcademicProgram["gradeBand"] : undefined,
    subdivisionId: row.subdivision_id != null ? String(row.subdivision_id) : undefined,
    requiredCredits: Number(row.required_credits),
    requiredClockHours: Number(row.required_clock_hours),
    requiredCompetencies: Number(row.required_competencies),
    typicalDurationPeriods: row.typical_duration_periods != null ? Number(row.typical_duration_periods) : undefined,
    status: String(row.status) as AcademicProgram["status"],
    effectiveFrom: row.effective_from != null ? String(row.effective_from).slice(0, 10) : undefined,
    effectiveTo: row.effective_to != null ? String(row.effective_to).slice(0, 10) : undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    createdByPersonId: row.created_by_person_id != null ? String(row.created_by_person_id) : undefined,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

const SELECT_COLS = `
  id, tenant_id, program_code, title, short_title, description,
  institution_mode, credential_type, grade_band, subdivision_id,
  required_credits, required_clock_hours, required_competencies,
  typical_duration_periods, status, effective_from, effective_to,
  created_at, created_by_person_id, updated_at
`;

export class PostgresAcademicProgramRepository implements AcademicProgramRepository {
  constructor(
    private readonly database: AcademicProgramDatabase = getDatabasePool() as AcademicProgramDatabase,
  ) {}

  async list(
    tenantId: string,
    filters: { status?: ProgramStatus; institutionMode?: ProgramInstitutionMode } = {},
  ): Promise<AcademicProgram[]> {
    const conditions: string[] = ["tenant_id = $1"];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.institutionMode) {
      conditions.push(`institution_mode = $${idx++}`);
      values.push(filters.institutionMode);
    }

    const result = await this.database.query(
      `select ${SELECT_COLS}
         from academy_academic_programs
        where ${conditions.join(" and ")}
        order by institution_mode, title`,
      values,
    );
    return result.rows.map(mapRow);
  }

  async findById(tenantId: string, id: string): Promise<AcademicProgram | undefined> {
    const result = await this.database.query(
      `select ${SELECT_COLS}
         from academy_academic_programs
        where tenant_id = $1 and id = $2`,
      [tenantId, id],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async findByCode(tenantId: string, programCode: string): Promise<AcademicProgram | undefined> {
    const result = await this.database.query(
      `select ${SELECT_COLS}
         from academy_academic_programs
        where tenant_id = $1 and program_code = $2`,
      [tenantId, programCode.toUpperCase()],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async create(input: CreateAcademicProgramInput): Promise<AcademicProgram> {
    const result = await this.database.query(
      `insert into academy_academic_programs (
         tenant_id, program_code, title, short_title, description,
         institution_mode, credential_type, grade_band, subdivision_id,
         required_credits, required_clock_hours, required_competencies,
         typical_duration_periods, status, effective_from, effective_to,
         created_by_person_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',$14,$15,$16)
       returning ${SELECT_COLS}`,
      [
        input.tenantId,
        input.programCode.toUpperCase(),
        input.title,
        input.shortTitle ?? null,
        input.description ?? null,
        input.institutionMode,
        input.credentialType,
        input.gradeBand ?? null,
        input.subdivisionId ?? null,
        input.requiredCredits ?? 0,
        input.requiredClockHours ?? 0,
        input.requiredCompetencies ?? 0,
        input.typicalDurationPeriods ?? null,
        input.effectiveFrom ?? null,
        input.effectiveTo ?? null,
        input.createdByPersonId ?? null,
      ],
    );

    if (!result.rows[0]) throw new Error("Program creation failed.");
    return mapRow(result.rows[0]);
  }

  async update(tenantId: string, id: string, input: UpdateAcademicProgramInput): Promise<AcademicProgram> {
    const sets: string[] = ["updated_at = now()"];
    const values: unknown[] = [tenantId, id];
    let idx = 3;

    if (input.title !== undefined) { sets.push(`title = $${idx++}`); values.push(input.title); }
    if (input.shortTitle !== undefined) { sets.push(`short_title = $${idx++}`); values.push(input.shortTitle); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); values.push(input.description); }
    if (input.gradeBand !== undefined) { sets.push(`grade_band = $${idx++}`); values.push(input.gradeBand); }
    if (input.subdivisionId !== undefined) { sets.push(`subdivision_id = $${idx++}`); values.push(input.subdivisionId); }
    if (input.requiredCredits !== undefined) { sets.push(`required_credits = $${idx++}`); values.push(input.requiredCredits); }
    if (input.requiredClockHours !== undefined) { sets.push(`required_clock_hours = $${idx++}`); values.push(input.requiredClockHours); }
    if (input.requiredCompetencies !== undefined) { sets.push(`required_competencies = $${idx++}`); values.push(input.requiredCompetencies); }
    if (input.typicalDurationPeriods !== undefined) { sets.push(`typical_duration_periods = $${idx++}`); values.push(input.typicalDurationPeriods); }
    if (input.status !== undefined) { sets.push(`status = $${idx++}`); values.push(input.status); }
    if (input.effectiveFrom !== undefined) { sets.push(`effective_from = $${idx++}`); values.push(input.effectiveFrom); }
    if (input.effectiveTo !== undefined) { sets.push(`effective_to = $${idx++}`); values.push(input.effectiveTo); }

    const result = await this.database.query(
      `update academy_academic_programs
          set ${sets.join(", ")}
        where tenant_id = $1 and id = $2
       returning ${SELECT_COLS}`,
      values,
    );

    if (!result.rows[0]) throw new Error(`Program ${id} was not found.`);
    return mapRow(result.rows[0]);
  }

  async archive(tenantId: string, id: string): Promise<AcademicProgram> {
    const result = await this.database.query(
      `update academy_academic_programs
          set status = 'archived', updated_at = now()
        where tenant_id = $1 and id = $2
       returning ${SELECT_COLS}`,
      [tenantId, id],
    );

    if (!result.rows[0]) throw new Error(`Program ${id} was not found.`);
    return mapRow(result.rows[0]);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    // Check for student program memberships
    const enrollments = await this.database.query(
      `select count(*) as cnt
         from academy_student_program_memberships
        where tenant_id = $1 and program_id = $2`,
      [tenantId, id],
    );

    const count = enrollments.rows[0] ? Number(enrollments.rows[0].cnt) : 0;
    if (count > 0) {
      throw new AcademyConflictError(
        `Cannot delete program with ${count} active student program membership(s).`,
      );
    }

    const result = await this.database.query(
      `delete from academy_academic_programs
        where tenant_id = $1 and id = $2`,
      [tenantId, id],
    );

    if (!result.rowCount || result.rowCount === 0) {
      throw new Error(`Program ${id} was not found.`);
    }
  }
}
