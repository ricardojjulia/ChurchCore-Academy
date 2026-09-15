import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { getDenominationRoster } from "@/modules/people/denomination";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const url = new URL(request.url);
    const denomination = url.searchParams.get("denomination");

    return withAcademyDatabaseContext(actor, async (client) => {
      return getDenominationRoster(actor, denomination, client);
    });
  });
}
