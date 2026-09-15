import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  updateAcademicYear,
  deleteAcademicYear,
  archiveAcademicYear,
  type UpdateAcademicYearInput,
} from "@/modules/academic-calendar/mutations";
import type { AcademicYear, AcademicPeriod } from "@/modules/academic-calendar/types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function toDateString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function optionalString(value: unknown) {
  return value === null || value === undefined ? undefined : String(value);
}

function mapAcademicYearRow(row: Record<string, unknown>): AcademicYear {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    code: String(row.code),
    startsOn: toDateString(row.starts_on),
    endsOn: toDateString(row.ends_on),
    status: row.status as AcademicYear["status"],
    calendarSystem: row.calendar_system as AcademicYear["calendarSystem"],
    subdivisionId: optionalString(row.subdivision_id),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapAcademicPeriodRow(row: Record<string, unknown>): AcademicPeriod {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    academicYearId: String(row.academic_year_id),
    parentPeriodId: optionalString(row.parent_period_id),
    subdivisionId: optionalString(row.subdivision_id),
    name: String(row.name),
    code: String(row.code),
    periodType: row.period_type as AcademicPeriod["periodType"],
    startsOn: toDateString(row.starts_on),
    endsOn: toDateString(row.ends_on),
    sequence: Number(row.sequence),
    status: row.status as AcademicPeriod["status"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<Queryable>(client);

      // Fetch year
      const yearResult = await db.query(
        `select * from academy_academic_years where tenant_id = $1 and id = $2`,
        [actor.tenantId, id],
      );

      if (!yearResult.rowCount || yearResult.rowCount === 0) {
        throw new Error(`Academic year ${id} not found.`);
      }

      const year = mapAcademicYearRow(yearResult.rows[0]);

      // Fetch periods for this year
      const periodsResult = await db.query(
        `select * from academy_academic_periods
         where tenant_id = $1 and academic_year_id = $2
         order by sequence`,
        [actor.tenantId, id],
      );

      const periods = periodsResult.rows.map(mapAcademicPeriodRow);

      return { year, periods };
    });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      if (body.action === "archive") {
        return archiveAcademicYear(actor, id, asAcademyDatabase<Queryable>(client));
      }

      const input: UpdateAcademicYearInput = {};
      if (typeof body.name === "string") input.name = body.name;
      if (typeof body.code === "string") input.code = body.code;
      if (typeof body.startsOn === "string") input.startsOn = body.startsOn;
      if (typeof body.endsOn === "string") input.endsOn = body.endsOn;

      return updateAcademicYear(actor, id, input, asAcademyDatabase<Queryable>(client));
    });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      await deleteAcademicYear(actor, id, asAcademyDatabase<Queryable>(client));
      return { success: true };
    });
  });
}
