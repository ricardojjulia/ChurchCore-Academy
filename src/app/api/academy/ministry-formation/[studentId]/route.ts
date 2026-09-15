import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { getStudentFormationRecord } from "@/modules/ministry-formation/service";

type RouteContext = { params: Promise<{ studentId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { studentId } = await context.params;
    return withCapabilityContext(actor, (client, capabilities) => {
      assertCapability(capabilities, "ministryFormation");
      return getStudentFormationRecord(actor, studentId, client);
    });
  });
}
