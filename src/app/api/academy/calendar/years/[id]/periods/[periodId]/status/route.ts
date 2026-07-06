import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { transitionTermState } from "@/modules/academic-calendar/mutations";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

interface RouteParams {
  params: Promise<{ id: string; periodId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  return handleApi(async () => {
    const { periodId } = await params;
    const body = (await request.json()) as { action: string };
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      // Map action to state
      const stateMap: Record<string, string> = {
        open_enrollment: "enrollment_open",
        activate: "active",
        complete: "completed",
        archive: "archived",
      };

      const newState = stateMap[body.action];
      if (!newState) {
        throw new Error(`Invalid action: ${body.action}`);
      }

      const period = await transitionTermState(
        actor,
        periodId,
        newState,
        asAcademyDatabase<Queryable>(client),
      );

      return { period };
    });
  });
}
