import { handleApi } from "@/app/api/academy/api-utils";
import { AcademyQueryClient } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { setFerpaRestriction } from "@/modules/people/guardian-access";

type RouteContext = { params: Promise<{ studentId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { studentId } = await context.params;
    const body = await request.json();
    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "guardianPortal");
      return setFerpaRestriction(
        actor,
        {
          studentPersonId: studentId,
          guardianPersonId: String(body.guardianPersonId),
          ferpaRestricted: Boolean(body.ferpaRestricted),
        },
        client as AcademyQueryClient,
      );
    });
  });
}
