import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assignFormationAdvisor } from "@/modules/ministry-formation/service";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    return withAcademyDatabaseContext(actor, (client) =>
      assignFormationAdvisor(actor, {
        studentPersonId: String(body.studentPersonId),
        advisorPersonId: String(body.advisorPersonId),
      }, client),
    );
  });
}
