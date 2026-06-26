import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { getLinkedStudentsForGuardian } from "@/modules/people/guardian-access";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    if (!actor.roles.includes("guardian")) {
      throw new AcademyAuthorizationError("Guardian role required.");
    }
    return withAcademyDatabaseContext(actor, (client) =>
      getLinkedStudentsForGuardian(actor.userId, actor.tenantId, client as Parameters<typeof getLinkedStudentsForGuardian>[2]),
    );
  });
}
