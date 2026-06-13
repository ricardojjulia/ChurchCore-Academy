import { handleApi } from "@/app/api/academy/api-utils";
import { AcademyActor, assertShepherdAiAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";

interface EvaluationResult {
  dataset: { tenantId: string };
  signals: unknown[];
  suggestions: unknown[];
  repository: {
    workflows: unknown[];
    workflowActions: unknown[];
    workflowFeedback: unknown[];
  };
}

type EvaluationRunner = () => Promise<EvaluationResult>;

export async function buildShepherdEvaluationPayload(actor: AcademyActor, runner: EvaluationRunner) {
  assertShepherdAiAccess(actor, actor.tenantId, "write");

  const result = await runner();
  if (result.dataset.tenantId !== actor.tenantId) {
    throw new Error("Forbidden ShepherdAI access.");
  }

  return {
    signals: result.signals,
    suggestions: result.suggestions,
    workflows: result.repository.workflows,
    workflowActions: result.repository.workflowActions,
    workflowFeedback: result.repository.workflowFeedback,
  };
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return buildShepherdEvaluationPayload(actor, () => runAcademicWorkflowEvaluationJob(actor.tenantId));
  });
}
