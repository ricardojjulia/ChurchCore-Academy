import { handleApi } from "@/app/api/academy/api-utils";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";

export async function POST() {
  return handleApi(async () => {
    const result = await runAcademicWorkflowEvaluationJob();
    return {
      signals: result.signals,
      suggestions: result.suggestions,
      workflows: result.repository.workflows,
      workflowActions: result.repository.workflowActions,
      workflowFeedback: result.repository.workflowFeedback,
    };
  });
}

