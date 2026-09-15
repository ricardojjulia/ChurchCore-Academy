import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
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
      return config.periods;
    });
  });
}
