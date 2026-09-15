import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { AcademyGradingRecordsRepository } from "@/modules/grading-records/postgres-repository";
import type { EvaluationRuleSet } from "@/modules/grading-records/types";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = (await request.json()) as Record<string, unknown>;

    if (!actor.roles.some((role) => ["institution_admin", "academic_admin"].includes(role))) {
      throw new AcademyAuthorizationError("Institution admin or academic admin role required.");
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "competencyNarrativeGrading");
      const repository = new AcademyGradingRecordsRepository(asAcademyDatabase(client));
      const config = await repository.fetchGradingRecordsConfiguration(actor.tenantId);
      return repository.createEvaluationRuleSet(
        actor,
        {
          courseId: String(body.courseId),
          sectionId: body.sectionId !== undefined && body.sectionId !== null ? String(body.sectionId) : undefined,
          evaluationType: body.evaluationType as EvaluationRuleSet["evaluationType"],
          scaleId: String(body.scaleId),
          recordType: body.recordType as EvaluationRuleSet["recordType"],
          gpaPolicy: body.gpaPolicy as EvaluationRuleSet["gpaPolicy"],
          creditPolicy: body.creditPolicy as EvaluationRuleSet["creditPolicy"],
          clockHourPolicy: body.clockHourPolicy as EvaluationRuleSet["clockHourPolicy"],
          competencyPolicy: body.competencyPolicy as EvaluationRuleSet["competencyPolicy"],
          narrativePolicy: body.narrativePolicy as EvaluationRuleSet["narrativePolicy"],
          postingPolicy: body.postingPolicy as EvaluationRuleSet["postingPolicy"],
          lmsGradeReturnPolicy: body.lmsGradeReturnPolicy as EvaluationRuleSet["lmsGradeReturnPolicy"],
          status: body.status as EvaluationRuleSet["status"],
        },
        config.gradingProfile,
      );
    });
  });
}
