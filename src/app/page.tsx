import Link from "next/link";
import { AcademyShell } from "@/components/academy-shell";
import { StatCard, WorkflowList } from "@/components/academy-ui";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";

export default async function Home() {
  const envStatus = {
    url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const evaluation = await runAcademicWorkflowEvaluationJob();
  const widgetItems = evaluation.workflows.getDashboardWidget(6);
  const highUrgencyCount = evaluation.suggestions.filter((item) => item.urgency === "high").length;
  const activeWorkflowCount = evaluation.repository.workflows.filter((workflow) => workflow.status !== "completed").length;

  return (
    <AcademyShell
      eyebrow="ChurchCore Academy"
      title="ShepherdAI Academy"
      subtitle="An explainable Academic Workflow recommendation engine for ChurchCore Academy. Structured SIS and college-management signals flow into deterministic scoring, optional draft support, and human-reviewed Suggested Academic Workflows."
    >
      <section className="hero-grid">
        <article className="panel hero-panel">
          <div className="hero-kicker">Administrative and academic-record intelligence</div>
          <h2>Purpose</h2>
          <p>
            ChurchCore Academy handles SIS, college management, enrollment, academic records, transcripts,
            faculty and administrator workflows, graduation and compliance tracking. It is not the LMS.
          </p>
          <div className="list-block">
            <strong>Workflow system</strong>
            <ul>
              <li>Incomplete enrollment</li>
              <li>Missing student documentation</li>
              <li>Transcript discrepancy review</li>
              <li>Graduation eligibility review</li>
              <li>Faculty assignment imbalance</li>
            </ul>
          </div>
          <div className="action-row">
            <Link className="action-link" href="/workflows">
              View Suggested Academic Workflows
            </Link>
            <Link className="action-link" href="/students/stu-maya-bennett">
              Open student insights
            </Link>
          </div>
        </article>

        <aside className="panel status-panel">
          <div className="section-heading">
            <h2>Platform readiness</h2>
          </div>
          <div className="status-row">
            <div>
              <div className="status-label">Supabase URL</div>
              <div className={envStatus.url ? "status-value status-good" : "status-value status-warn"}>
                {envStatus.url ? "Configured" : "Not set"}
              </div>
            </div>
          </div>
          <div className="status-row">
            <div>
              <div className="status-label">Publishable key</div>
              <div className={envStatus.publishableKey ? "status-value status-good" : "status-value status-warn"}>
                {envStatus.publishableKey ? "Configured" : "Not set"}
              </div>
            </div>
          </div>
          <div className="status-row">
            <div>
              <div className="status-label">Service role key</div>
              <div className={envStatus.serviceRoleKey ? "status-value status-good" : "status-value status-warn"}>
                {envStatus.serviceRoleKey ? "Configured" : "Not set"}
              </div>
            </div>
          </div>
          <p className="muted-text">
            LLM support is optional and bounded. Core workflow triggering, scoring, standing, transcript review,
            and graduation checks remain deterministic.
          </p>
        </aside>
      </section>

      <section className="stats-grid">
        <StatCard label="Suggested Academic Workflows" value={evaluation.suggestions.length} tone="gold" detail="Generated from Academy-only structured signals" />
        <StatCard label="High urgency recommendations" value={highUrgencyCount} tone="alert" detail="Requires timely administrative review" />
        <StatCard label="Active workflows" value={activeWorkflowCount} detail="Promoted from suggestions for human action" />
        <StatCard label="Students in evaluation set" value={academyDataset.students.length} detail="No cross-product data access" />
      </section>

      <section className="three-column">
        <section className="panel">
          <div className="section-heading">
            <h2>Academic Workflows</h2>
          </div>
          <div className="list-block">
            <ul>
              <li>Incomplete enrollment follow-up</li>
              <li>Missing student documentation review</li>
              <li>Graduation eligibility review</li>
              <li>Academic standing or credit progress review</li>
              <li>Transcript or records inconsistency review</li>
              <li>Faculty or course assignment imbalance review</li>
            </ul>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Guardrails</h2>
          </div>
          <div className="list-block">
            <ul>
              <li>Not a chatbot and not a general assistant</li>
              <li>No data sharing with Ops, Learning, or Care</li>
              <li>No final graduation or standing decisions without deterministic institutional rules</li>
              <li>No shaming, motive inference, or spiritual labeling</li>
            </ul>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Source signal categories</h2>
          </div>
          <div className="token-row">
            <span className="token">enrollment-signals</span>
            <span className="token">student-record-signals</span>
            <span className="token">graduation-signals</span>
            <span className="token">transcript-signals</span>
            <span className="token">faculty-admin-signals</span>
          </div>
        </section>
      </section>

      <WorkflowList
        title="Suggested Academic Workflows"
        items={widgetItems}
        emptyMessage="No workflow suggestions are available yet."
      />
    </AcademyShell>
  );
}
