import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { recordFormationEvaluation } from "@/modules/ministry-formation/service";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    return withCapabilityContext(actor, (client, capabilities) => {
      assertCapability(capabilities, "ministryFormation");
      return recordFormationEvaluation(actor, {
        studentPersonId: String(body.studentPersonId),
        rubricLabel: String(body.rubricLabel),
        scores: body.scores as Record<string, number>,
        pastoralNotes: body.pastoralNotes ? String(body.pastoralNotes) : undefined,
        evaluationDate: String(body.evaluationDate),
      }, client);
    });
  });
}
