import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { getStudentInterventions, type ConductDatabase } from "@/modules/people/conduct";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: studentPersonId } = await params;

    return withAcademyDatabaseContext(actor, (client) =>
      getStudentInterventions(actor, studentPersonId, asAcademyDatabase<ConductDatabase>(client)),
    );
  });
}
