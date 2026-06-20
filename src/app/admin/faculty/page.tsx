import { AdminShell } from "@/components/admin-shell";
import { StatCard, SuggestionDetail, WorkflowRecordList } from "@/components/academy-ui";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import type { ShepherdAiDatabase } from "@/modules/shepherd-ai/postgres-repository";
import { InMemoryAcademicWorkflowRepository } from "@/modules/academic-workflows/repository";

export default async function FacultyPage() {
  const actor = await requireActor();

  const { suggestions, workflows } = await withAcademyDatabaseContext(actor, async (client) => {
    const repo = new ShepherdAiPostgresRepository(asAcademyDatabase<ShepherdAiDatabase>(client));
    const [s, w] = await Promise.all([
      repo.fetchSuggestions(actor.tenantId),
      repo.fetchWorkflows(actor.tenantId),
    ]);
    return { suggestions: s, workflows: w };
  });

  const facultySuggestions = suggestions.filter(
    (s) =>
      s.workflowCode === "faculty_or_course_assignment_imbalance_review" &&
      (s.entityType === "faculty" || s.entityType === "course_section"),
  );
  const facultyWorkflows = workflows.filter(
    (w) => w.workflowCode === "faculty_or_course_assignment_imbalance_review",
  );
  const repository = new InMemoryAcademicWorkflowRepository(suggestions, workflows);

  return (
    <AdminShell
      eyebrow="Faculty and Administration"
      title="Faculty assignment and course setup review"
      subtitle="ShepherdAI Academy surfaces staffing imbalances, advisor overload, and section setup concerns as Suggested Academic Workflows for academic administrators."
    >
      <section className="stats-grid">
        <StatCard label="Faculty/admin alerts" value={facultySuggestions.length} tone="alert" detail="Deterministic staffing and setup review" />
        <StatCard label="Open faculty workflows" value={facultyWorkflows.length} tone="gold" detail="Academic administration queue" />
        <StatCard label="Sections needing setup review" value={2} detail="Instructor, capacity, or setup review needed" />
      </section>

      <section className="content-grid">
        <div className="stack">
          <section className="panel">
            <div className="section-heading">
              <h2 className="text-xl font-bold text-foreground">Faculty assignment imbalance alerts</h2>
            </div>
            <div className="workflow-list">
              {facultySuggestions.map((suggestion) => (
                <SuggestionDetail key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>
          </section>
        </div>

        <div className="stack">
          <WorkflowRecordList workflows={facultyWorkflows} repository={repository} />
          <section className="panel">
            <div className="section-heading">
              <h2 className="text-xl font-bold text-foreground">Administrative boundary</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              These alerts are framed as administrative review items. They do not criticize faculty performance and do not infer intent or capability beyond Academy staffing and setup data.
            </p>
          </section>
        </div>
      </section>
    </AdminShell>
  );
}
