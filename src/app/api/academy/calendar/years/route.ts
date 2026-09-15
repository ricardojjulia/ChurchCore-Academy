import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  createAcademicYear,
  type CreateAcademicYearInput,
} from "@/modules/academic-calendar/mutations";
import { AcademyCalendarRepository } from "@/modules/academic-calendar/postgres-repository";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const config = await new AcademyCalendarRepository(
        asAcademyDatabase<Queryable>(client)
      ).fetchAcademicCalendarConfiguration(actor.tenantId);
      return config.academicYears;
    });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    if (typeof body.name !== "string" || !body.name) {
      throw new Error("Academic year name is required.");
    }
    if (typeof body.code !== "string" || !body.code) {
      throw new Error("Academic year code is required.");
    }
    if (typeof body.startsOn !== "string" || !body.startsOn) {
      throw new Error("Start date is required.");
    }
    if (typeof body.endsOn !== "string" || !body.endsOn) {
      throw new Error("End date is required.");
    }
    if (typeof body.calendarSystem !== "string" || !body.calendarSystem) {
      throw new Error("Calendar system is required.");
    }

    const input: CreateAcademicYearInput = {
      name: body.name,
      code: body.code,
      startsOn: body.startsOn,
      endsOn: body.endsOn,
      calendarSystem: body.calendarSystem as never,
      subdivisionId: typeof body.subdivisionId === "string" ? body.subdivisionId : undefined,
    };

    return withAcademyDatabaseContext(actor, async (client) => {
      return createAcademicYear(actor, input, asAcademyDatabase<Queryable>(client));
    });
  });
}
