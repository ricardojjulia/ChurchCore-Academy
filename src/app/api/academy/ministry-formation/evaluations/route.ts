import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { recordFormationEvaluation } from "@/modules/ministry-formation/service";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    return withAcademyDatabaseContext(actor, (client) =>
      recordFormationEvaluation(actor, {
        studentPersonId: String(body.studentPersonId),
        evaluatorNameSnapshot: String(body.evaluatorNameSnapshot),
        rubricLabel: String(body.rubricLabel),
        scores: body.scores as Record<string, number>,
        pastoralNotes: body.pastoralNotes ? String(body.pastoralNotes) : undefined,
        evaluationDate: String(body.evaluationDate),
      }, client),
    );
  });
}
