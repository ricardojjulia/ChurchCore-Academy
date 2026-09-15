import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import {
  getConductRecord,
  updateConductStatus,
  type UpdateConductStatusInput,
  type ConductDatabase,
} from "@/modules/people/conduct";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;

    return withAcademyDatabaseContext(actor, (client) =>
      getConductRecord(actor, id, asAcademyDatabase<ConductDatabase>(client)),
    );
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    const body = (await request.json()) as UpdateConductStatusInput;

    return withAcademyDatabaseContext(actor, (client) =>
      updateConductStatus(actor, id, body, asAcademyDatabase<ConductDatabase>(client)),
    );
  });
}
