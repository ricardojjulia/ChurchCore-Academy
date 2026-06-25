import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
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

    return withAcademyDatabaseContext(actor, async (client) => {
      return updateDenominationMembership(actor, membershipId, body, client);
    });
  });
}
