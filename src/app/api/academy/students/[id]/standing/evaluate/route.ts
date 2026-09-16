import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { createStandingEvaluation } from "@/modules/grading-records/standing-persistence";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    if (!actor.roles.some((role) => ["registrar", "academic_admin"].includes(role))) {
      throw new AcademyAuthorizationError("Registrar or academic admin role required.");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const academicYearId = typeof body.academicYearId === "string" ? body.academicYearId : undefined;
    const periodId = typeof body.periodId === "string" ? body.periodId : undefined;

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "academicStandingAutomation");
      return createStandingEvaluation(
        actor,
        {
          studentPersonId: id,
          academicYearId,
          periodId,
        },
        client,
      );
    });
  });
}
