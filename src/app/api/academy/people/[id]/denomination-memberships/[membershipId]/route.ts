import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import {
  updateDenominationMembership,
  UpdateDenominationMembershipInput,
} from "@/modules/people/denomination";

type RouteContext = {
  params: Promise<{ id: string; membershipId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { membershipId } = await context.params;
    const body = (await request.json()) as UpdateDenominationMembershipInput;

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "denominationTracking");
      return updateDenominationMembership(actor, membershipId, body, client);
    });
  });
}
