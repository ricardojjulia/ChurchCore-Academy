import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { StatCard, SuggestionDetail } from "@/components/academy-ui";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { fetchProgramList, fetchStudentRecords, fetchSectionList } from "@/lib/academy-read-models";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import type { ShepherdAiDatabase } from "@/modules/shepherd-ai/postgres-repository";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireActor();

  const { programs, students, sections, suggestions } = await withAcademyDatabaseContext(actor, async (client) => {
    const shepherdRepo = new ShepherdAiPostgresRepository(asAcademyDatabase<ShepherdAiDatabase>(client));
    const [allPrograms, allStudents, allSections, allSuggestions] = await Promise.all([
      fetchProgramList(actor.tenantId, client),
      fetchStudentRecords(actor.tenantId, client),
      fetchSectionList(actor.tenantId, client),
      shepherdRepo.fetchSuggestions(actor.tenantId),
    ]);
    return { programs: allPrograms, students: allStudents, sections: allSections, suggestions: allSuggestions };
  });

  const program = programs.find((item) => item.id === id);
  if (!program) notFound();

  const studentIds = new Set(students.filter((s) => s.programId === id).map((s) => s.id));
  const sectionIds = new Set(sections.filter((s) => s.programId === id).map((s) => s.id));
  const programSuggestions = suggestions.filter(
    (s) =>
      (s.entityType === "student" && studentIds.has(s.entityId)) ||
      (s.entityType === "course_section" && sectionIds.has(s.entityId)),
  );

  const graduationReady = programSuggestions.filter((item) => item.workflowCode === "graduation_eligibility_review");
  const progressReviews = programSuggestions.filter((item) => item.workflowCode === "academic_standing_or_credit_progress_review");
  const requirementItems = programSuggestions.filter(
    (item) =>
      item.workflowCode === "missing_documentation_review" ||
      item.workflowCode === "transcript_or_records_inconsistency_review",
  );

  return (
    <AdminShell
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
    </AdminShell>
  );
}
