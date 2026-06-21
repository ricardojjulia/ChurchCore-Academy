import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { FacultyShell } from "@/components/faculty-shell";
import { ReEvaluateButton } from "@/components/re-evaluate-button";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import type { ShepherdAiDatabase } from "@/modules/shepherd-ai/postgres-repository";
import { AlertTriangle, BookOpen, ClipboardList, ShieldCheck, Sparkles } from "lucide-react";
import type { ShepherdAiSuggestion } from "@/modules/shepherd-ai/types";

export const dynamic = "force-dynamic";

function urgencyClass(urgency: string) {
  if (urgency === "critical") return "signal-badge-critical";
  if (urgency === "high") return "signal-badge-high";
  if (urgency === "medium") return "signal-badge-medium";
  return "signal-badge-low";
}

function SuggestionCard({ s }: { s: ShepherdAiSuggestion }) {
  return (
    <div className="ops-panel" style={{ padding: "1.25rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <Sparkles size={14} strokeWidth={2} />
            <strong style={{ fontSize: "0.9375rem" }}>{s.title}</strong>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", margin: 0 }}>{s.summary}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          <span className={`admin-signal-badge ${urgencyClass(s.urgency)}`} data-level={s.urgency}>
            {s.urgency}
          </span>
          <span className="admin-signal-badge" data-level="low">{s.confidenceScore}%</span>
        </div>
      </div>

      {s.explanation.whySurfaced.length > 0 && (
        <div style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem", fontWeight: 600 }}>
            <AlertTriangle size={12} strokeWidth={2} />
            Why this surfaced
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {s.explanation.whySurfaced.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      )}

      {s.suggestedActions.length > 0 && (
        <div style={{ fontSize: "0.8125rem", color: "var(--muted-foreground)", marginTop: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem", fontWeight: 600 }}>
            <ClipboardList size={12} strokeWidth={2} />
            Suggested next steps
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {s.suggestedActions.map((a) => <li key={a.label}>{a.label}</li>)}
          </ul>
        </div>
      )}

      <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <ShieldCheck size={11} strokeWidth={2} />
        {s.boundaryNote}
      </div>
    </div>
  );
}

export default async function FacultyShepherdPage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const actor = await requireActor();

  const ownedSectionIds = await withAcademyDatabaseContext(actor, async (client) => {
    const result = await client.query(
      "select id from academy_course_sections where tenant_id = $1 and primary_instructor_id = $2",
      [actor.tenantId, actor.userId],
    ) as { rows: { id: string }[] };
    return new Set(result.rows.map((r) => r.id));
  });

  let suggestions: ShepherdAiSuggestion[] = [];

  try {
    const all = await withAcademyDatabaseContext(actor, (client) =>
      new ShepherdAiPostgresRepository(asAcademyDatabase<ShepherdAiDatabase>(client)).fetchSuggestions(actor.tenantId),
    );

    suggestions = all.filter(
      (s) =>
        s.workflowCode === "faculty_or_course_assignment_imbalance_review" ||
        s.workflowCode === "calendar_setup_review" ||
        (s.entityType === "course_section" && ownedSectionIds.has(s.entityId)) ||
        (s.entityType === "faculty" && s.entityId === actor.userId),
    );
  } catch {
    // graceful degradation — DB unavailable; page shows empty state
  }

  const critical = suggestions.filter((s) => s.urgency === "critical" || s.urgency === "high");
  const other = suggestions.filter((s) => s.urgency !== "critical" && s.urgency !== "high");

  return (
    <FacultyShell
      eyebrow="ShepherdAI"
      title="Faculty Signals"
      subtitle="Explainable academic workflow recommendations for faculty assignments and course setup. All signals are human-reviewed before action."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div className="ops-metric" style={{ flex: "0 0 auto", minWidth: "160px" }}>
            <div style={{ padding: "1rem" }}>
              <div className="ops-metric-label">Total signals</div>
              <div className="ops-metric-value">{suggestions.length}</div>
              <div className="ops-metric-detail"><Sparkles size={13} /> Faculty &amp; setup signals</div>
            </div>
          </div>
          <div className="ops-metric" style={{ flex: "0 0 auto", minWidth: "160px" }}>
            <div style={{ padding: "1rem" }}>
              <div className="ops-metric-label">High urgency</div>
              <div className="ops-metric-value">{critical.length}</div>
              <div className="ops-metric-detail"><AlertTriangle size={13} /> Requires attention</div>
            </div>
          </div>
        </div>
        <ReEvaluateButton endpoint="/api/academy/shepherd-ai/evaluate" label="Re-evaluate" />
      </div>

      {suggestions.length === 0 ? (
        <div className="ops-panel" style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", color: "var(--muted-foreground)" }}>
            <BookOpen size={24} strokeWidth={1.5} />
            <p style={{ margin: 0 }}>No active faculty or setup signals at this time.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {critical.length > 0 && (
            <section>
              <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: "0.5rem" }}>
                High Priority
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {critical.map((s) => <SuggestionCard key={s.id} s={s} />)}
              </div>
            </section>
          )}
          {other.length > 0 && (
            <section>
              <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--muted-foreground)", marginBottom: "0.5rem" }}>
                Other Signals
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {other.map((s) => <SuggestionCard key={s.id} s={s} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </FacultyShell>
  );
}
