import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { AcademyGradingRecordsRepository } from "@/modules/grading-records/postgres-repository";
import type { EvaluationRuleSet } from "@/modules/grading-records/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    if (!actor.roles.some((role) => ["institution_admin", "academic_admin"].includes(role))) {
      throw new AcademyAuthorizationError("Institution admin or academic admin role required.");
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "competencyNarrativeGrading");
      const repository = new AcademyGradingRecordsRepository(asAcademyDatabase(client));
      const config = await repository.fetchGradingRecordsConfiguration(actor.tenantId);

      const updates: Record<string, unknown> = {};
      if (body.gpaPolicy !== undefined) updates.gpaPolicy = body.gpaPolicy as EvaluationRuleSet["gpaPolicy"];
      if (body.creditPolicy !== undefined) updates.creditPolicy = body.creditPolicy as EvaluationRuleSet["creditPolicy"];
      if (body.clockHourPolicy !== undefined) updates.clockHourPolicy = body.clockHourPolicy as EvaluationRuleSet["clockHourPolicy"];
      if (body.competencyPolicy !== undefined) updates.competencyPolicy = body.competencyPolicy as EvaluationRuleSet["competencyPolicy"];
      if (body.narrativePolicy !== undefined) updates.narrativePolicy = body.narrativePolicy as EvaluationRuleSet["narrativePolicy"];
      if (body.postingPolicy !== undefined) updates.postingPolicy = body.postingPolicy as EvaluationRuleSet["postingPolicy"];
      if (body.lmsGradeReturnPolicy !== undefined) updates.lmsGradeReturnPolicy = body.lmsGradeReturnPolicy as EvaluationRuleSet["lmsGradeReturnPolicy"];
      if (body.status !== undefined) updates.status = body.status as EvaluationRuleSet["status"];

      return repository.updateEvaluationRuleSet(actor, id, updates, config.gradingProfile);
    });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;

    if (!actor.roles.some((role) => ["institution_admin", "academic_admin"].includes(role))) {
      throw new AcademyAuthorizationError("Institution admin or academic admin role required.");
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "competencyNarrativeGrading");
      const repository = new AcademyGradingRecordsRepository(asAcademyDatabase(client));
      await repository.deleteEvaluationRuleSet(actor, id);
      return { success: true };
    });
  });
}
