import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { getDenominationRoster } from "@/modules/people/denomination";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const url = new URL(request.url);
    const denomination = url.searchParams.get("denomination");

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "denominationTracking");
      return getDenominationRoster(actor, denomination, client);
    });
  });
}
