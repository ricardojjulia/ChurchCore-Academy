import { notFound } from "next/navigation";
import { AcademyShell } from "@/components/academy-shell";
import { StatCard, SuggestionDetail } from "@/components/academy-ui";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const program = academyDataset.programs.find((item) => item.id === id);

  if (!program) {
    notFound();
  }

  const evaluation = await runAcademicWorkflowEvaluationJob();
  const suggestions = evaluation.workflows.getProgramSuggestions(id);
  const graduationReady = suggestions.filter((item) => item.workflowCode === "graduation_eligibility_review");
  const progressReviews = suggestions.filter((item) => item.workflowCode === "academic_standing_or_credit_progress_review");
  const requirementItems = suggestions.filter(
    (item) =>
      item.workflowCode === "missing_documentation_review" ||
      item.workflowCode === "transcript_or_records_inconsistency_review",
  );

  return (
    <AcademyShell
      eyebrow="Program and Cohort Panel"
      title={program.name}
      subtitle={`${program.cohortLabel}. Review graduation readiness, academic progress, and missing requirement summaries from ShepherdAI Academy.`}
    >
      <section className="stats-grid">
        <StatCard label="Graduation readiness items" value={graduationReady.length} tone="gold" detail="Suggested registrar review" />
        <StatCard label="Academic progress review items" value={progressReviews.length} tone="alert" detail="Advisor follow-up candidates" />
        <StatCard label="Requirement summaries" value={requirementItems.length} detail="Documentation and records review" />
      </section>

      <section className="three-column">
        <section className="panel">
          <div className="section-heading">
            <h2>Graduation readiness items</h2>
          </div>
          <div className="workflow-list compact-list">
            {graduationReady.map((suggestion) => (
              <SuggestionDetail key={suggestion.id} suggestion={suggestion} />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Academic progress review items</h2>
          </div>
          <div className="workflow-list compact-list">
            {progressReviews.map((suggestion) => (
              <SuggestionDetail key={suggestion.id} suggestion={suggestion} />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Missing requirement summaries</h2>
          </div>
          <div className="workflow-list compact-list">
            {requirementItems.map((suggestion) => (
              <SuggestionDetail key={suggestion.id} suggestion={suggestion} />
            ))}
          </div>
        </section>
      </section>
    </AcademyShell>
  );
}
