import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  updateTerm,
  deleteTerm,
  type UpdateTermInput,
} from "@/modules/academic-calendar/mutations";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    const forceUpdate = body.forceUpdate === true;

    const input: UpdateTermInput = {};

    if (typeof body.name === "string") input.name = body.name;
    if (typeof body.code === "string") input.code = body.code;
    if (typeof body.startsOn === "string") input.startsOn = body.startsOn;
    if (typeof body.endsOn === "string") input.endsOn = body.endsOn;
    if (typeof body.sequence === "number") input.sequence = body.sequence;

    return withAcademyDatabaseContext(actor, async (client) => {
      return updateTerm(actor, id, input, forceUpdate, asAcademyDatabase<Queryable>(client));
    });
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      await deleteTerm(actor, id, asAcademyDatabase<Queryable>(client));
      return { success: true };
    });
  });
}
