import { handleApi, requireStringField } from "@/app/api/academy/api-utils";
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
          courseId: requireStringField(body.courseId, "courseId"),
          sectionId: body.sectionId !== undefined && body.sectionId !== null ? requireStringField(body.sectionId, "sectionId") : undefined,
          evaluationType: requireStringField(body.evaluationType, "evaluationType") as EvaluationRuleSet["evaluationType"],
          scaleId: requireStringField(body.scaleId, "scaleId"),
          recordType: requireStringField(body.recordType, "recordType") as EvaluationRuleSet["recordType"],
          gpaPolicy: requireStringField(body.gpaPolicy, "gpaPolicy") as EvaluationRuleSet["gpaPolicy"],
          creditPolicy: requireStringField(body.creditPolicy, "creditPolicy") as EvaluationRuleSet["creditPolicy"],
          clockHourPolicy: requireStringField(body.clockHourPolicy, "clockHourPolicy") as EvaluationRuleSet["clockHourPolicy"],
          competencyPolicy: requireStringField(body.competencyPolicy, "competencyPolicy") as EvaluationRuleSet["competencyPolicy"],
          narrativePolicy: requireStringField(body.narrativePolicy, "narrativePolicy") as EvaluationRuleSet["narrativePolicy"],
          postingPolicy: requireStringField(body.postingPolicy, "postingPolicy") as EvaluationRuleSet["postingPolicy"],
          lmsGradeReturnPolicy: requireStringField(body.lmsGradeReturnPolicy, "lmsGradeReturnPolicy") as EvaluationRuleSet["lmsGradeReturnPolicy"],
          status: requireStringField(body.status, "status") as EvaluationRuleSet["status"],
        },
        config.gradingProfile,
      );
    });
  });
}
