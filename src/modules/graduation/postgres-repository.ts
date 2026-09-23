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
        input.action === "clear" ? now : null,
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
