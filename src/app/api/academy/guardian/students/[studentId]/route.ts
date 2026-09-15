import { handleApi } from "@/app/api/academy/api-utils";
import { AcademyQueryClient } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { assertCapability } from "@/modules/academy-auth/policy";
import { fetchGuardianStudentSummary } from "@/modules/people/guardian-access";

type RouteContext = { params: Promise<{ studentId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    if (!actor.roles.includes("guardian")) {
      throw new AcademyAuthorizationError("Guardian role required.");
    }
    const { studentId } = await context.params;
    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "guardianPortal");
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
