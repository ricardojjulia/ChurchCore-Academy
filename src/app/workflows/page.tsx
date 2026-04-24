import { AcademyShell } from "@/components/academy-shell";
import { WorkflowQueueBoard } from "@/components/academy-workflow-queue";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";

export const dynamic = "force-dynamic";

export default async function WorkflowQueuePage() {
  const evaluation = await runAcademicWorkflowEvaluationJob();
  const items = evaluation.workflows.getWorkflowQueue({ status: "all" });

  return (
    <AcademyShell
      eyebrow="Academic Workflows"
      title="Suggested Academic Workflows"
      subtitle="Review explainable ShepherdAI Academy recommendations and promoted workflows. All items remain human-reviewed academic-administrative suggestions."
    >
      <WorkflowQueueBoard initialItems={items} administrators={evaluation.dataset.administrators} />
    </AcademyShell>
  );
}
