import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, AcademyQueryClient } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { setFerpaRestriction } from "@/modules/people/guardian-access";

type RouteContext = { params: Promise<{ studentId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { studentId } = await context.params;
    const body = await request.json();
    return withAcademyDatabaseContext(actor, (client) =>
      setFerpaRestriction(
        actor,
        {
          studentPersonId: studentId,
          guardianPersonId: String(body.guardianPersonId),
          ferpaRestricted: Boolean(body.ferpaRestricted),
        },
        client as AcademyQueryClient,
      ),
    );
  });
}
