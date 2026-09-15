import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { updateInterventionStatus, type InterventionStatus, type ConductDatabase } from "@/modules/people/conduct";

interface UpdateInterventionRequest {
  status: InterventionStatus;
  outcomeNotes?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    const body = (await request.json()) as UpdateInterventionRequest;

    return withAcademyDatabaseContext(actor, (client) =>
      updateInterventionStatus(
        actor,
        id,
        body.status,
        body.outcomeNotes,
        asAcademyDatabase<ConductDatabase>(client),
      ),
    );
  });
}
