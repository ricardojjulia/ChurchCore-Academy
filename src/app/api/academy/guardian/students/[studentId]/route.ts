import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, AcademyQueryClient } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { fetchGuardianStudentSummary } from "@/modules/people/guardian-access";

type RouteContext = { params: Promise<{ studentId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    if (!actor.roles.includes("guardian")) {
      throw new AcademyAuthorizationError("Guardian role required.");
    }
    const { studentId } = await context.params;
    return withAcademyDatabaseContext(actor, async (client) => {
      const result = await fetchGuardianStudentSummary(
        actor.userId,
        studentId,
        actor.tenantId,
        client as AcademyQueryClient,
      );
      if (result === null) {
        return { ferpaRestricted: true };
      }
      return result;
    });
  });
}
