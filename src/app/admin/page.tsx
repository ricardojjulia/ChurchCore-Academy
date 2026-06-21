import Link from "next/link";
import type React from "react";
import {
  ArrowRight,
  BookOpenCheck,
  BookOpen,
  CircleDollarSign,
  ClipboardCheck,
  FileWarning,
  GraduationCap,
  ListChecks,
  School,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import {
  asAcademyDatabase,
  type AcademyQueryClient,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getInstitutionProfile } from "@/lib/institution";
import { requireActor } from "@/lib/require-actor";
import {
  ShepherdAiPostgresRepository,
  type ShepherdAiDatabase,
} from "@/modules/shepherd-ai/postgres-repository";

export const dynamic = "force-dynamic";

const quickActions = [
  { label: "Review Applications", detail: "Admissions queue", href: "/admin/admissions", Icon: ClipboardCheck },
  { label: "Student Records", detail: "Index, profiles, history", href: "/admin/students", Icon: UsersRound },
  { label: "Programs", detail: "Cohorts and readiness", href: "/admin/programs", Icon: GraduationCap },
  { label: "Course Catalog", detail: "Courses and sections", href: "/admin/courses", Icon: BookOpen },
  { label: "Graduation", detail: "Credit readiness and holds", href: "/admin/graduation", Icon: GraduationCap },
  { label: "ShepherdAI Queue", detail: "Human-reviewed signals", href: "/admin/workflows", Icon: Sparkles },
  { label: "Gradebook", detail: "Grades and override audit", href: "/admin/gradebook", Icon: School },
  { label: "Billing", detail: "Ledger and payments", href: "/admin/billing", Icon: CircleDollarSign },
  { label: "Faculty", detail: "Staffing and section setup", href: "/admin/faculty", Icon: BookOpenCheck },
  { label: "Student PWA", detail: "Student-facing records", href: "/student", Icon: ArrowRight },
];

type CountQueryResult = {
  rows: Array<{ count: string | number | bigint }>;
};

async function countTenantRows(
  client: AcademyQueryClient,
  sql: string,
  tenantId: string,
) {
  const result = (await client.query(sql, [tenantId])) as CountQueryResult;
  return Number(result.rows[0]?.count ?? 0);
}

export default async function AdminDashboard() {
  const actor = await requireActor();
  const user = await getCurrentUser();
  const institution = await getInstitutionProfile(actor.tenantId);

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const dashboardData = await withAcademyDatabaseContext(actor, async (client) => {
    const shepherdAiRepository = new ShepherdAiPostgresRepository(
      asAcademyDatabase<ShepherdAiDatabase>(client),
    );

    const suggestions = await shepherdAiRepository.fetchSuggestions(
      actor.tenantId,
    );
    const workflows = await shepherdAiRepository.fetchWorkflows(actor.tenantId);
    const studentsCount = await countTenantRows(
      client,
      "select count(*)::int as count from academy_student_profiles where tenant_id = $1",
      actor.tenantId,
    );
    const programsCount = await countTenantRows(
      client,
      "select count(*)::int as count from academy_programs where tenant_id = $1",
      actor.tenantId,
    );
    const facultyCount = await countTenantRows(
      client,
      "select count(*)::int as count from academy_staff_profiles where tenant_id = $1",
      actor.tenantId,
    );

    return {
      suggestions,
      workflows,
      studentsCount,
      programsCount,
      facultyCount,
    };
  });

  const { suggestions, workflows, studentsCount, programsCount, facultyCount } =
    dashboardData;
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
          detail="Tenant-scoped records"
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
