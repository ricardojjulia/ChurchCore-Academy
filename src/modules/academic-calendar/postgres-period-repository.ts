import type { AcademyDatabase } from "@/lib/academy-database-context";
import type { AcademicPeriod, AcademicYear } from "./types";
import { PermanentRecordError } from "../academy-errors";

function mapPeriodRow(row: Record<string, unknown>): AcademicPeriod {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    academicYearId: String(row.academic_year_id),
    parentPeriodId: row.parent_period_id ? String(row.parent_period_id) : undefined,
    subdivisionId: row.subdivision_id ? String(row.subdivision_id) : undefined,
    name: String(row.name),
    code: String(row.code),
    periodType: row.period_type as AcademicPeriod["periodType"],
    startsOn: new Date(row.starts_on as string).toISOString().slice(0, 10),
    endsOn: new Date(row.ends_on as string).toISOString().slice(0, 10),
    sequence: Number(row.sequence),
    status: row.status as AcademicPeriod["status"],
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}



/**
 * This is a partial implementation for the purpose of this feature.
 * A full implementation would have more robust error handling and queries.
 */
export class PostgresAcademicPeriodRepository {
  constructor(private db: AcademyDatabase, private tenantId: string) {}

  async createPeriod(tenantId: string, data: Omit<AcademicPeriod, "id" | "tenantId" | "createdAt" | "updatedAt" | "status">): Promise<AcademicPeriod> {
    const result = await this.db.query(
      `insert into academy_academic_periods (
        tenant_id, academic_year_id, parent_period_id, name, code, period_type, starts_on, ends_on, sequence, status
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'planned')
      returning *`,
      [
        tenantId,
        data.academicYearId,
        data.parentPeriodId ?? null,
        data.name,
        data.code,
        data.periodType,
        data.startsOn,
        data.endsOn,
        data.sequence,
      ],
    );
    return mapPeriodRow(result.rows[0]);
  }

  async updatePeriod(tenantId: string, periodId: string, data: Partial<Omit<AcademicPeriod, "id" | "tenantId" | "createdAt" | "updatedAt" | "status">>): Promise<AcademicPeriod> {
    const fields = Object.keys(data).map((key, i) => `"${key}" = $${i + 3}`).join(", ");
    const values = Object.values(data);

    const result = await this.db.query(
      `update academy_academic_periods set ${fields} where id = $1 and tenant_id = $2 returning *`,
      [periodId, tenantId, ...values],
    );
    return mapPeriodRow(result.rows[0]);
  }

  async fetchPeriodById(tenantId: string, periodId: string): Promise<AcademicPeriod | null> {
    const result = await this.db.query(
      `select * from academy_academic_periods where id = $1 and tenant_id = $2`,
      [periodId, tenantId],
    );
    if (result.rows.length === 0) {
      return null;
    }
    return mapPeriodRow(result.rows[0]);
  }

  async updatePeriodStatus(tenantId: string, periodId: string, status: AcademicPeriod["status"]): Promise<AcademicPeriod> {
    const result = await this.db.query(
      `update academy_academic_periods set status = $3 where id = $1 and tenant_id = $2 returning *`,
      [periodId, tenantId, status],
    );
    return mapPeriodRow(result.rows[0]);
  }

  async listPeriods(tenantId: string): Promise<AcademicPeriod[]> {
    const result = await this.db.query(
      `select * from academy_academic_periods where tenant_id = $1 order by starts_on desc`,
      [tenantId],
    );
    return result.rows.map(mapPeriodRow);
  }

  async listYears(tenantId: string): Promise<AcademicYear[]> {
    const result = await this.db.query(
      `select id, name, code, starts_on as "startsOn", ends_on as "endsOn", status, calendar_system as "calendarSystem"
       from academy_academic_years
       where tenant_id = $1
       order by starts_on desc`,
      [tenantId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      tenantId,
      name: String(row.name),
      code: String(row.code),
      startsOn: row.startsOn instanceof Date ? row.startsOn.toISOString().slice(0, 10) : String(row.startsOn).slice(0, 10),
      endsOn: row.endsOn instanceof Date ? row.endsOn.toISOString().slice(0, 10) : String(row.endsOn).slice(0, 10),
      status: String(row.status) as unknown as AcademicYear["status"],
      calendarSystem: String(row.calendarSystem) as unknown as AcademicYear["calendarSystem"],
      createdAt: "",
      updatedAt: "",
    }));
  }

  async assertPeriodIsNotCompleted(periodId: string): Promise<void> {
    const result = await this.db.query(
      `SELECT status FROM academy_academic_periods WHERE id = $1 AND tenant_id = $2`,
      [periodId, this.tenantId]
    );

    const status = result.rows[0]?.status;

    if (status === "completed") {
      throw new PermanentRecordError(`The academic period '${periodId}' is completed and its records are locked.`);
    }
  }
}