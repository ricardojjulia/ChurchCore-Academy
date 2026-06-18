import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { FacultyShell } from "@/components/faculty-shell";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";
import Link from "next/link";
import { BookOpen, CalendarDays, ClipboardCheck, TriangleAlert, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FacultyPortal() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const rawName = user?.email?.split("@")[0] ?? "there";
  const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  let dataset: Awaited<ReturnType<typeof loadProtectedAcademyDataset>>["dataset"] | null = null;
  let evaluation: Awaited<ReturnType<typeof runAcademicWorkflowEvaluationJob>> | null = null;

  try {
    const result = await loadProtectedAcademyDataset();
    dataset = result.dataset;
    evaluation = await runAcademicWorkflowEvaluationJob(result.actor.tenantId, dataset, null);
  } catch {
    // graceful degradation if seed data unavailable
  }

  const sections = dataset?.sections ?? [];
  const faculty = dataset?.faculty ?? [];
  const suggestions = evaluation?.suggestions ?? [];
  const facultySignals = suggestions.filter(
    (s) => s.workflowCode === "faculty_or_course_assignment_imbalance_review",
  );

  // For demo: treat sections with setup alerts as "attendance due"
  const attendanceDue = sections.filter((s) => s.setupAlerts.length > 0);
  // Sections with partial roster (< 50% capacity) flagged for grade entry review
  const gradeEntryQueue = sections.filter(
    (s) => s.rosterCount > 0 && s.rosterCount < s.rosterCapacity * 0.5,
  );

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <FacultyShell
      eyebrow="ChurchCore Academy"
      title="Faculty Portal"
      subtitle={`${today} — manage your sections, grading, and student progress.`}
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <p className="admin-greeting">
        {greeting}, <strong>{firstName}</strong>. Here&rsquo;s your day.
      </p>

      {/* Stat row */}
      <section className="ops-stats-grid">
        <div className="faculty-stat">
          <span className="faculty-stat-icon"><CalendarDays /></span>
          <span className="faculty-stat-value">{sections.length}</span>
          <span className="faculty-stat-label">Active sections</span>
        </div>
        <div className="faculty-stat">
          <span className="faculty-stat-icon"><ClipboardCheck /></span>
          <span className="faculty-stat-value">{attendanceDue.length}</span>
          <span className="faculty-stat-label">Attendance due</span>
        </div>
        <div className="faculty-stat">
          <span className="faculty-stat-icon"><BookOpen /></span>
          <span className="faculty-stat-value">{gradeEntryQueue.length}</span>
          <span className="faculty-stat-label">Grade entry queue</span>
        </div>
        <div className="faculty-stat">
          <span className="faculty-stat-icon"><Users /></span>
          <span className="faculty-stat-value">{faculty.length}</span>
          <span className="faculty-stat-label">Faculty on record</span>
        </div>
      </section>

      <div className="admin-dashboard-grid">
        {/* Today's sections */}
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Today&rsquo;s Sections</h2>
            <Link href="/faculty/sections">View all →</Link>
          </div>
          {sections.length === 0 ? (
            <p className="admin-signal-empty">No sections found for this tenant.</p>
          ) : (
            <div className="faculty-section-list">
              {sections.slice(0, 6).map((s) => (
                <div key={s.id} className="faculty-section-row">
                  <span className="faculty-section-code">{s.code}</span>
                  <span className="faculty-section-title">{s.title}</span>
                  <span className="faculty-section-roster">
                    {s.rosterCount}/{s.rosterCapacity}
                  </span>
                  {s.setupAlerts.length > 0 && (
                    <span className="faculty-section-alert" title={s.setupAlerts.join(", ")}>
                      <TriangleAlert size={13} strokeWidth={2} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ShepherdAI faculty signals */}
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>ShepherdAI Faculty Signals</h2>
            <Link href="/faculty/shepherd">View all →</Link>
          </div>
          {facultySignals.length === 0 ? (
            <p className="admin-signal-empty">No active faculty signals.</p>
          ) : (
            <div className="admin-signal-list">
              {facultySignals.slice(0, 5).map((s) => (
                <div key={s.id} className="admin-signal-row">
                  <span
                    className="admin-signal-urgency"
                    data-level={s.urgency}
                    aria-hidden="true"
                  />
                  <span className="admin-signal-name">{s.summary}</span>
                  <span className="admin-signal-badge" data-level={s.urgency}>
                    {s.urgency}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grade entry queue */}
      {gradeEntryQueue.length > 0 && (
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Grade Entry Queue</h2>
            <Link href="/faculty/gradebook">Enter grades →</Link>
          </div>
          <div className="faculty-section-list">
            {gradeEntryQueue.map((s) => (
              <div key={s.id} className="faculty-section-row">
                <span className="faculty-section-code">{s.code}</span>
                <span className="faculty-section-title">{s.title}</span>
                <span className="faculty-section-roster">
                  {s.rosterCount} student{s.rosterCount !== 1 ? "s" : ""} enrolled
                </span>
                <Link
                  href={`/faculty/gradebook?section=${s.id}`}
                  className="faculty-grade-link"
                >
                  Enter grades →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </FacultyShell>
  );
}
