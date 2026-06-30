import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { assertCapability } from "@/modules/academy-auth/policy";
import { getLinkedStudentsForGuardian } from "@/modules/people/guardian-access";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    if (!actor.roles.includes("guardian")) {
      throw new AcademyAuthorizationError("Guardian role required.");
    }
    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "guardianPortal");
      return getLinkedStudentsForGuardian(actor.userId, actor.tenantId, client as Parameters<typeof getLinkedStudentsForGuardian>[2]);
    });
  });
}
