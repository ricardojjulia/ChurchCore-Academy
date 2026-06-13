import { AcademyShell } from "@/components/academy-shell";
import { StatCard, SuggestionDetail, WorkflowRecordList } from "@/components/academy-ui";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";

export default async function FacultyPage() {
  const { actor, dataset } = await loadProtectedAcademyDataset();
  const evaluation = await runAcademicWorkflowEvaluationJob(
    actor.tenantId,
    dataset,
  );
  const suggestions = evaluation.workflows.getFacultySuggestions();
  const facultyWorkflows = evaluation.repository.workflows.filter((workflow) => workflow.workflowCode === "faculty_or_course_assignment_imbalance_review");

  return (
    <AcademyShell
      eyebrow="Faculty and Administration"
      title="Faculty assignment and course setup review"
      subtitle="ShepherdAI Academy surfaces staffing imbalances, advisor overload, and section setup concerns as Suggested Academic Workflows for academic administrators."
    >
      <section className="stats-grid">
        <StatCard label="Faculty/admin alerts" value={suggestions.length} tone="alert" detail="Deterministic staffing and setup review" />
        <StatCard label="Open faculty workflows" value={facultyWorkflows.length} tone="gold" detail="Academic administration queue" />
        <StatCard label="Sections needing setup review" value={2} detail="Instructor, capacity, or setup review needed" />
      </section>

      <section className="content-grid">
        <div className="stack">
          <section className="panel">
            <div className="section-heading">
              <h2>Faculty assignment imbalance alerts</h2>
            </div>
            <div className="workflow-list">
              {suggestions.map((suggestion) => (
                <SuggestionDetail key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>
          </section>
        </div>

        <div className="stack">
          <WorkflowRecordList workflows={facultyWorkflows} repository={evaluation.repository} />
          <section className="panel">
            <div className="section-heading">
              <h2>Administrative boundary</h2>
            </div>
            <p className="muted-text">
              These alerts are framed as administrative review items. They do not criticize faculty performance and do not infer intent or capability beyond Academy staffing and setup data.
            </p>
          </section>
        </div>
      </section>
    </AcademyShell>
  );
}
