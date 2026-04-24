import { AcademyShell } from "@/components/academy-shell";
import { WorkflowList } from "@/components/academy-ui";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";
import { QueueFilters, WorkflowCode } from "@/modules/shepherd-ai/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getFilter(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "all";
}

function asWorkflowCode(value: string) {
  const allowed = new Set<WorkflowCode>([
    "incomplete-enrollment-follow-up",
    "missing-student-documentation-review",
    "graduation-eligibility-review",
    "academic-progress-review",
    "transcript-records-inconsistency-review",
    "faculty-course-assignment-imbalance-review",
  ]);

  return allowed.has(value as WorkflowCode) ? (value as WorkflowCode) : "all";
}

export default async function WorkflowQueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const urgency = getFilter(params.urgency);
  const status = getFilter(params.status);
  const assignee = getFilter(params.assignee);
  const workflowCode = asWorkflowCode(getFilter(params.workflowCode));
  const evaluation = await runAcademicWorkflowEvaluationJob();
  const filters: QueueFilters = {
    urgency: urgency as QueueFilters["urgency"],
    status: status as QueueFilters["status"],
    assignee,
    workflowCode,
  };
  const items = evaluation.workflows.getWorkflowQueue(filters);

  return (
    <AcademyShell
      eyebrow="Academic Workflows"
      title="Suggested Academic Workflows"
      subtitle="Review explainable ShepherdAI Academy recommendations and promoted workflows. All items remain human-reviewed academic-administrative suggestions."
    >
      <section className="panel filter-panel">
        <div className="section-heading">
          <h2>Queue filters</h2>
        </div>
        <div className="token-row">
          <span className="token">Urgency: {urgency}</span>
          <span className="token">Status: {status}</span>
          <span className="token">Assignee: {assignee}</span>
          <span className="token">Workflow type: {workflowCode}</span>
        </div>
      </section>

      <WorkflowList
        title="Workflow queue"
        items={items}
        emptyMessage="No academic workflow suggestions match the current filters."
      />
    </AcademyShell>
  );
}
