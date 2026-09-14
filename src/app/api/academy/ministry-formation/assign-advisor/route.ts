import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { assignFormationAdvisor } from "@/modules/ministry-formation/service";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    return withCapabilityContext(actor, (client, capabilities) => {
      assertCapability(capabilities, "ministryFormation");
      return assignFormationAdvisor(actor, {
        studentPersonId: String(body.studentPersonId),
        advisorPersonId: String(body.advisorPersonId),
      }, client);
    });
  });
}
