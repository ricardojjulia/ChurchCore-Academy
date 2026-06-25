import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { createIntervention, type CreateInterventionInput, type ConductDatabase } from "@/modules/people/conduct";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: conductRecordId } = await params;
    const body = (await request.json()) as Omit<CreateInterventionInput, "conductRecordId">;

    return withAcademyDatabaseContext(actor, (client) =>
      createIntervention(
        actor,
        { ...body, conductRecordId },
        asAcademyDatabase<ConductDatabase>(client),
      ),
    );
  });
}
