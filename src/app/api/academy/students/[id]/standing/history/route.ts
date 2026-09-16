import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { listStandingEvaluations } from "@/modules/grading-records/standing-persistence";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    if (!actor.roles.some((role) => ["registrar", "academic_admin"].includes(role))) {
      throw new AcademyAuthorizationError("Registrar or academic admin role required.");
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    let limit = 10;
    let offset = 0;

    if (limitParam !== null) {
      const parsedLimit = Number(limitParam);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        throw new Error("limit must be an integer between 1 and 100.");
      }
      limit = parsedLimit;
    }

    if (offsetParam !== null) {
      const parsedOffset = Number(offsetParam);
      if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        throw new Error("offset must be a non-negative integer.");
      }
      offset = parsedOffset;
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "academicStandingAutomation");
      return listStandingEvaluations(actor, id, client, limit, offset);
    });
  });
}
