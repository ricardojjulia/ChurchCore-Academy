import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { getAlumniRoster, type AlumniStatus } from "@/modules/people/alumni";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { searchParams } = new URL(request.url);

    const yearParam = searchParams.get("graduationYear");
    const statusParam = searchParams.get("status");

    const filters: { graduationYear?: number; status?: AlumniStatus } = {};
    if (yearParam) filters.graduationYear = parseInt(yearParam, 10);
    if (statusParam) filters.status = statusParam as AlumniStatus;

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");
      return getAlumniRoster(actor, filters, client);
    });
  });
}
