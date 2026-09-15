import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  createPeriod,
  type CreatePeriodInput,
} from "@/modules/academic-calendar/mutations";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    if (typeof body.name !== "string" || !body.name) {
      throw new Error("Period name is required.");
    }
    if (typeof body.code !== "string" || !body.code) {
      throw new Error("Period code is required.");
    }
    if (typeof body.periodType !== "string" || !body.periodType) {
      throw new Error("Period type is required.");
    }
    if (typeof body.startsOn !== "string" || !body.startsOn) {
      throw new Error("Start date is required.");
    }
    if (typeof body.endsOn !== "string" || !body.endsOn) {
      throw new Error("End date is required.");
    }
    if (typeof body.sequence !== "number") {
      throw new Error("Sequence is required.");
    }

    const input: CreatePeriodInput = {
      termId: id,
      name: body.name,
      code: body.code,
      periodType: body.periodType,
      startsOn: body.startsOn,
      endsOn: body.endsOn,
      sequence: body.sequence,
    };

    return withAcademyDatabaseContext(actor, async (client) => {
      return createPeriod(actor, input, asAcademyDatabase<Queryable>(client));
    });
  });
}
