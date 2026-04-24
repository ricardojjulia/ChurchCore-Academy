import { notFound } from "next/navigation";
import { AcademyShell } from "@/components/academy-shell";
import { StatCard, SuggestionDetail, WorkflowRecordList } from "@/components/academy-ui";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = academyDataset.students.find((item) => item.id === id);

  if (!student) {
    notFound();
  }

  const program = academyDataset.programs.find((item) => item.id === student.programId);
  const evaluation = await runAcademicWorkflowEvaluationJob();
  const suggestions = evaluation.workflows.getStudentSuggestions(id);
  const workflows = evaluation.workflows.getStudentWorkflows(id);

  return (
    <AcademyShell
      eyebrow="Student Profile"
      title={student.fullName}
      subtitle={`${program?.name ?? "Pending program assignment"} · ShepherdAI Insights and Academic Workflows are based only on ChurchCore Academy SIS and academic-record data.`}
    >
      <section className="stats-grid">
        <StatCard label="Enrollment status" value={student.enrollmentStatus.replaceAll("_", " ")} tone="gold" />
        <StatCard label="Credits earned" value={student.creditsEarned} detail={`Expected by now: ${student.expectedCreditsByNow}`} />
        <StatCard label="Open suggestions" value={suggestions.length} tone="alert" detail="Suggested Academic Workflows" />
      </section>

      <section className="content-grid">
        <div className="stack">
          <section className="panel">
            <div className="section-heading">
              <h2>ShepherdAI Insights</h2>
            </div>
            <div className="workflow-list">
              {suggestions.map((suggestion) => (
                <SuggestionDetail key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>
          </section>
        </div>

        <div className="stack">
          <WorkflowRecordList workflows={workflows} repository={evaluation.repository} />

          <section className="panel">
            <div className="section-heading">
              <h2>Recent administrative signals summary</h2>
            </div>
            <div className="list-block">
              <ul>
                {student.missingEnrollmentSteps.map((step) => (
                  <li key={step}>Enrollment step pending: {step}</li>
                ))}
                {student.documentationNotes.map((note) => (
                  <li key={note}>Documentation note: {note}</li>
                ))}
                {student.transcriptAlerts.map((alert) => (
                  <li key={alert}>Transcript alert: {alert}</li>
                ))}
                {student.recordAlerts.map((alert) => (
                  <li key={alert}>Record alert: {alert}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </section>
    </AcademyShell>
  );
}
