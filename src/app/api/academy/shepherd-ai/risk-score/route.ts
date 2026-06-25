import { NextRequest } from "next/server";
import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { scoreStudentRisk, type ScoreStudentRiskInput } from "@/modules/shepherd-ai/retention-risk";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();

    if (!body.studentPersonId || typeof body.studentPersonId !== "string") {
      throw new Error("studentPersonId is required.");
    }
    if (!body.scoringPeriod || typeof body.scoringPeriod !== "string") {
      throw new Error("scoringPeriod is required.");
    }

    const input: ScoreStudentRiskInput = {
      studentPersonId: body.studentPersonId,
      scoringPeriod: body.scoringPeriod,
    };

    return withAcademyDatabaseContext(actor, (client) =>
      scoreStudentRisk(actor, input, asAcademyDatabase(client)),
    );
  }, { operation: "shepherd_ai.score_student_risk" });
}
