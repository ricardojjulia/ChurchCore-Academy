import Link from "next/link";
import type React from "react";
import {
  ArrowRight,
  BookOpenCheck,
  BookOpen,
  ClipboardCheck,
  FileWarning,
  GraduationCap,
  ListChecks,
  School,
  Sparkles,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getInstitutionProfile } from "@/lib/institution";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";

export const dynamic = "force-dynamic";

const quickActions = [
  { label: "Review Applications", detail: "Admissions queue", href: "/admin/admissions", Icon: ClipboardCheck },
  { label: "Student Records", detail: "Index, profiles, history", href: "/admin/students", Icon: UsersRound },
  { label: "Programs", detail: "Cohorts and readiness", href: "/admin/programs", Icon: GraduationCap },
  { label: "Course Catalog", detail: "Courses and sections", href: "/admin/courses", Icon: BookOpen },
  { label: "Graduation", detail: "Credit readiness and holds", href: "/admin/graduation", Icon: GraduationCap },
  { label: "ShepherdAI Queue", detail: "Human-reviewed signals", href: "/admin/workflows", Icon: Sparkles },
  { label: "Gradebook", detail: "Grades and override audit", href: "/admin/gradebook", Icon: School },
  { label: "Faculty", detail: "Staffing and section setup", href: "/admin/faculty", Icon: BookOpenCheck },
  { label: "Student PWA", detail: "Student-facing records", href: "/student", Icon: ArrowRight },
];

function isSeedDataUnavailableError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.toLowerCase().includes("is not seeded") ||
      error.message.toLowerCase().includes("institution profile is not seeded"))
  );
}

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  // tenantId derives from the verified Supabase session only — never from caller-supplied headers.
  const tenantId = user?.tenantId ?? "cca-main";
  const institution = await getInstitutionProfile(tenantId);

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  let evaluation: Awaited<
    ReturnType<typeof runAcademicWorkflowEvaluationJob>
  > | null = null;
  let seedDataWarning: string | null = null;

  try {
    evaluation = await runAcademicWorkflowEvaluationJob(tenantId);
  } catch (error) {
    if (!isSeedDataUnavailableError(error)) throw error;
    seedDataWarning =
      "Academy dataset is not seeded for this tenant yet. Metrics remain hidden until seeding completes.";
  }

  const suggestions = evaluation?.suggestions ?? [];
  const workflows = evaluation?.repository.workflows ?? [];
  const studentsCount = evaluation?.dataset.students.length ?? 0;
  const programsCount = evaluation?.dataset.programs.length ?? 0;
  const facultyCount = evaluation?.dataset.faculty.length ?? 0;
  const highUrgencyCount = suggestions.filter(
    (s) => s.urgency === "high" || s.urgency === "critical",
  ).length;
  const activeWorkflowCount = workflows.filter(
    (w) => w.status !== "completed",
  ).length;
  const missingDocCount = suggestions.filter(
    (s) => s.workflowCode === "missing_documentation_review",
  ).length;

  const rawName = user?.email?.split("@")[0] ?? "there";
  const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <AdminShell
      eyebrow={institution?.institutionName ?? "ChurchCore Academy"}
      title="Academic Dashboard"
      subtitle="Faith-based education management — students, records, grading, faculty workflows, and institutional operations."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <p className="admin-greeting">
        {greeting}, <strong>{firstName}</strong>. Here&rsquo;s where things
        stand.
      </p>

      {evaluation ? (
        <>
          {/* Stat row */}
          <section className="ops-stats-grid">
            <DashboardMetric
              label="ShepherdAI Signals"
              value={suggestions.length}
              icon={<Sparkles />}
              detail="Open details"
              bars={[3, 5, 4, 7, suggestions.length]}
              href="/admin/workflows"
            />
            <DashboardMetric
              label="High urgency"
              value={highUrgencyCount}
              icon={<FileWarning />}
              detail="May require timely review"
              bars={[1, 2, 1, 3, highUrgencyCount]}
              accent="danger"
            />
            <DashboardMetric
              label="Active workflows"
              value={activeWorkflowCount}
              icon={<ListChecks />}
              detail="Promoted for human action"
              bars={[2, 4, 3, 5, activeWorkflowCount]}
            />
            <DashboardMetric
              label="Documentation cases"
              value={missingDocCount}
              icon={<ClipboardCheck />}
              detail="Record completion review"
              bars={[1, 1, 2, 2, missingDocCount]}
              accent="warn"
            />
          </section>

          <section className="ops-stats-grid">
            <DashboardMetric
              label="Students"
              value={studentsCount}
              icon={<UsersRound />}
              detail="Tenant-scoped dataset"
              bars={[2, 3, 3, 4, studentsCount]}
            />
            <DashboardMetric
              label="Programs"
              value={programsCount}
              icon={<GraduationCap />}
              detail="Tracked academic programs"
              bars={[1, 2, 2, 3, programsCount]}
            />
            <DashboardMetric
              label="Faculty records"
              value={facultyCount}
              icon={<BookOpenCheck />}
              detail="Load and advisor review"
              bars={[1, 2, 3, 3, facultyCount]}
            />
            <DashboardMetric
              label="Signal categories"
              value={5}
              icon={<Sparkles />}
              detail="Enrollment, records, progress, transcripts, faculty"
              bars={[3, 4, 4, 5, 5]}
            />
          </section>

          {/* Middle: quick-actions + signals */}
          <div className="admin-dashboard-grid">
            <div className="admin-panel">
              <div className="admin-panel-heading">
                <h2>Start Here</h2>
              </div>
              <div className="admin-quick-actions">
                {quickActions.map((action) => {
                  const { Icon } = action;
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="admin-quick-action"
                    >
                      <span className="admin-quick-action-icon">
                        <Icon />
                      </span>
                      <span>
                        {action.label}
                        <span>{action.detail}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="admin-panel">
              <div className="admin-panel-heading">
                <h2>ShepherdAI Signals</h2>
                <Link href="/admin/workflows">View all →</Link>
              </div>
              {suggestions.length === 0 ? (
                <p className="admin-signal-empty">
                  No active signals at this time.
                </p>
              ) : (
                <div className="admin-signal-list">
                  {suggestions.slice(0, 5).map((s) => (
                    <div key={s.id} className="admin-signal-row">
                      <span
                        className="admin-signal-urgency"
                        data-level={s.urgency}
                        aria-hidden="true"
                      />
                      <span className="admin-signal-name">{s.summary}</span>
                      <span
                        className="admin-signal-badge"
                        data-level={s.urgency}
                      >
                        {s.urgency}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <section className="ops-empty-state" aria-live="polite">
          <Card className="ops-panel ops-empty-card">
            <CardContent>
              <div className="ops-empty-header">
                <span className="ops-empty-icon" aria-hidden="true">
                  <TriangleAlert />
                </span>
                <div>
                  <p className="ops-empty-eyebrow">Tenant setup required</p>
                  <h3>Dashboard data is not ready yet</h3>
                </div>
              </div>
              <p className="ops-empty-copy">
                {seedDataWarning ??
                  "Academy runtime data is unavailable for this tenant."}
              </p>
              <div className="ops-empty-actions">
                <Link href="/platform/control" className="academy-action-link">
                  Open Platform Control
                </Link>
                <Link
                  href="/admin/settings/institution"
                  className="academy-action-link"
                >
                  Review Institution Setup
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="admin-panel">
            <div className="admin-panel-heading">
              <h2>Start Here</h2>
            </div>
            <div className="admin-quick-actions">
              {quickActions.map((action) => {
                const { Icon } = action;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="admin-quick-action"
                  >
                    <span className="admin-quick-action-icon">
                      <Icon />
                    </span>
                    <span>
                      {action.label}
                      <span>{action.detail}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </AdminShell>
  );
}

function DashboardMetric({
  label,
  value,
  icon,
  detail,
  bars,
  accent,
  href,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  detail: string;
  bars?: number[];
  accent?: "danger" | "warn";
  href?: string;
}) {
  const max = bars ? Math.max(...bars, 1) : 1;
  const content = (
    <Card className="ops-metric">
      <CardContent>
        <div className="ops-metric-inner">
          <div className="ops-metric-label">{label}</div>
          <div className="ops-metric-value">{value}</div>
          <div className="ops-metric-detail">
            <span>{icon}</span>
            {detail}
          </div>
          {bars && (
            <div
              className="ops-metric-bars"
              data-accent={accent ?? "default"}
            >
              {bars.map((bar, i) => (
                <div
                  key={i}
                  className="ops-metric-bar"
                  style={{ "--bar-h": `${Math.round((bar / max) * 100)}%` } as React.CSSProperties}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
  if (!href) return content;
  return (
    <Link
      href={href}
      className="ops-metric-link"
      aria-label={`${label} - open details`}
    >
      {content}
    </Link>
  );
}
