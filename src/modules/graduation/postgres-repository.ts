import { getDatabasePool } from "@/lib/database";
import {
  GraduationClearance,
  GraduationClearanceRepository,
  GraduationClearanceStatus,
  InitiateClearanceInput,
  UpdateClearanceInput,
} from "@/modules/graduation/types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface GraduationDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function optionalIso(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : iso(value);
}

function optionalString(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

export function mapGraduationClearanceRow(
  row: Record<string, unknown>,
): GraduationClearance {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentProfileId: String(row.student_profile_id),
    academicProgramId: String(row.academic_program_id),
    academicYearId: String(row.academic_year_id),
    status: row.status as GraduationClearanceStatus,
    initiatedByPersonId: String(row.initiated_by_person_id),
    initiatedAt: iso(row.initiated_at),
    clearedByPersonId: optionalString(row.cleared_by_person_id),
    clearedAt: optionalIso(row.cleared_at),
    deferredReason: optionalString(row.deferred_reason),
    notes: optionalString(row.notes),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export class PostgresGraduationClearanceRepository
  implements GraduationClearanceRepository
{
  constructor(
    private readonly database: GraduationDatabase = getDatabasePool(),
  ) {}

  async create(
    tenantId: string,
    initiatedByPersonId: string,
    input: InitiateClearanceInput,
  ): Promise<GraduationClearance> {
    const result = await this.database.query(
      `insert into academy_graduation_clearances
         (tenant_id, student_profile_id, academic_program_id, academic_year_id, initiated_by_person_id)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [
        tenantId,
        input.studentProfileId,
        input.academicProgramId,
        input.academicYearId,
        initiatedByPersonId,
      ],
    );
    return mapGraduationClearanceRow(result.rows[0]);
  }

  async update(
    tenantId: string,
    clearedByPersonId: string,
    input: UpdateClearanceInput,
  ): Promise<GraduationClearance> {
    const now = new Date().toISOString();
    const newStatus: GraduationClearanceStatus =
      input.action === "clear" ? "cleared" : "deferred";

    const result = await this.database.query(
      `update academy_graduation_clearances
          set status                = $1,
              cleared_by_person_id  = $2,
              cleared_at            = $3,
              deferred_reason       = $4,
              notes                 = $5,
              updated_at            = $6
        where tenant_id = $7 and id = $8
       returning *`,
      [
        newStatus,
        clearedByPersonId,
        // cleared_by/cleared_at record who decided and when, for a deferral too (the table
        // requires both for any non-pending status).
        now,
        input.deferredReason ?? null,
        input.notes ?? null,
        now,
        tenantId,
        input.clearanceId,
      ],
    );
    return mapGraduationClearanceRow(result.rows[0]);
  }

  async findByStudent(
    tenantId: string,
    studentProfileId: string,
  ): Promise<GraduationClearance | undefined> {
    const result = await this.database.query(
      `select *
         from academy_graduation_clearances
        where tenant_id = $1 and student_profile_id = $2
        order by initiated_at desc
        limit 1`,
      [tenantId, studentProfileId],
    );
    return result.rows[0]
      ? mapGraduationClearanceRow(result.rows[0])
      : undefined;
  }

  async studentBelongsToTenant(tenantId: string, studentProfileId: string): Promise<boolean> {
    const result = await this.database.query(
      `select 1 from academy_student_profiles where tenant_id = $1 and id = $2`,
      [tenantId, studentProfileId],
    );
    return Boolean(result.rowCount);
  }

  async latestStatusesForStudents(
    tenantId: string,
    studentProfileIds: string[],
  ): Promise<Map<string, GraduationClearanceStatus>> {
    // Profile ids are text; a uuid[] cast here failed for every real id.
    const result = await this.database.query(
      `select distinct on (student_profile_id) student_profile_id, status
         from academy_graduation_clearances
        where tenant_id = $1 and student_profile_id = any($2::text[])
        order by student_profile_id, initiated_at desc`,
      [tenantId, studentProfileIds],
    );
    return new Map(
      result.rows.map((row) => [String(row.student_profile_id), row.status as GraduationClearanceStatus]),
    );
  }

  async findById(
    tenantId: string,
    clearanceId: string,
  ): Promise<GraduationClearance | undefined> {
    const result = await this.database.query(
      `select *
         from academy_graduation_clearances
        where tenant_id = $1 and id = $2`,
      [tenantId, clearanceId],
    );
    return result.rows[0]
      ? mapGraduationClearanceRow(result.rows[0])
      : undefined;
  }
}
