import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  updatePeriod,
  type UpdatePeriodInput,
} from "@/modules/academic-calendar/mutations";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; periodId: string }> },
) {
  return handleApi(async () => {
    const { periodId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    const input: UpdatePeriodInput = {};

    if (typeof body.name === "string") input.name = body.name;
    if (typeof body.code === "string") input.code = body.code;
    if (typeof body.startsOn === "string") input.startsOn = body.startsOn;
    if (typeof body.endsOn === "string") input.endsOn = body.endsOn;
    if (typeof body.sequence === "number") input.sequence = body.sequence;

    return withAcademyDatabaseContext(actor, async (client) => {
      return updatePeriod(actor, periodId, input, asAcademyDatabase<Queryable>(client));
    });
  });
}
