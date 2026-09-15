import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  resolveAcademicContext,
  saveAcademicContext,
} from "@/modules/academic-calendar/user-context-repository";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      return resolveAcademicContext(
        actor.userId,
        actor.tenantId,
        asAcademyDatabase<Queryable>(client),
      );
    });
  });
}

export async function PUT(request: Request) {
  return handleApi(async () => {
    const body = (await request.json()) as {
      activeYearId?: string | null;
      activePeriodId?: string | null;
    };
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<Queryable>(client);

      // When yearId changes, clear periodId
      let yearId: string | null = null;
      let periodId: string | null = null;

      if (body.activeYearId !== undefined) {
        yearId = body.activeYearId;
        periodId = null; // Clear period when year changes
      } else if (body.activePeriodId !== undefined) {
        // Fetch current year from saved context
        const currentContext = await db.query(
          `select active_academic_year_id from academy_user_context
           where user_id = $1 and tenant_id = $2`,
          [actor.userId, actor.tenantId],
        );

        yearId =
          currentContext.rowCount && currentContext.rowCount > 0
            ? String(currentContext.rows[0].active_academic_year_id)
            : null;
        periodId = body.activePeriodId;
      }

      await saveAcademicContext(
        actor.userId,
        actor.tenantId,
        yearId,
        periodId,
        db,
      );

      return resolveAcademicContext(
        actor.userId,
        actor.tenantId,
        db,
      );
    });
  });
}
