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
  HandCoins,
  ListChecks,
  MessageSquare,
  School,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const quickActionGroups = [
  {
    label: "Student records",
    description: "Daily admissions, enrollment, and academic record work",
    actions: [
      { label: "Applications", detail: "Review and decide on new applicants", href: "/admin/admissions", Icon: ClipboardCheck },
      { label: "Student Records", detail: "Profiles, history, and advisor notes", href: "/admin/students", Icon: UsersRound },
      { label: "Programs", detail: "Cohort readiness and graduation tracking", href: "/admin/programs", Icon: GraduationCap },
      { label: "Graduation", detail: "Credit completion and hold review", href: "/admin/graduation", Icon: GraduationCap },
    ],
  },
  {
    label: "Academics",
    description: "Course delivery, grading, and faculty oversight",
    actions: [
      { label: "Course Catalog", detail: "Courses, sections, and scheduling", href: "/admin/courses", Icon: BookOpen },
      { label: "Gradebook", detail: "Grade progress and posting queue", href: "/admin/gradebook", Icon: School },
      { label: "Faculty", detail: "Staffing, load, and section setup", href: "/admin/faculty", Icon: BookOpenCheck },
    ],
  },
  {
    label: "Operations",
    description: "Communications, finance, and student-facing tools",
    actions: [
      { label: "ShepherdAI Queue", detail: "Recommendations and workflow queue", href: "/admin/workflows", Icon: Sparkles },
      { label: "Communications", detail: "Messages and institutional notices", href: "/admin/communications", Icon: MessageSquare },
      { label: "Billing", detail: "Student ledger and payment activity", href: "/admin/billing", Icon: CircleDollarSign },
      { label: "Financial Aid", detail: "Awards and disbursement review", href: "/admin/financial-aid", Icon: HandCoins },
      { label: "Student Portal", detail: "Preview the student-facing experience", href: "/student", Icon: ArrowRight },
    ],
  },
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

    const suggestions = await shepherdAiRepository.fetchSuggestions(actor.tenantId);
    const workflows = await shepherdAiRepository.fetchWorkflows(actor.tenantId);
    const studentsCount = await countTenantRows(
      client,
      "select count(*)::int as count from academy_student_profiles where tenant_id = $1",
      actor.tenantId,
    );

    return { suggestions, workflows, studentsCount };
  });

  const { suggestions, workflows, studentsCount } = dashboardData;

  const highUrgencyCount = suggestions.filter(
    (s) => s.urgency === "high" || s.urgency === "critical",
  ).length;
  const activeWorkflowCount = workflows.filter((w) => w.status !== "completed").length;
  const missingDocCount = suggestions.filter(
    (s) => s.workflowCode === "missing_documentation_review",
  ).length;

  const byCategory = {
    graduation: suggestions.filter((s) => s.workflowCode === "graduation_eligibility_review").length,
    progress: suggestions.filter((s) => s.workflowCode === "academic_standing_or_credit_progress_review").length,
    documentation: missingDocCount,
    faculty: suggestions.filter((s) => s.workflowCode === "faculty_or_course_assignment_imbalance_review").length,
  };

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
        {greeting}, <strong>{firstName}</strong>. Here&rsquo;s where things stand.
      </p>

      {/* Metrics — every tile links to the relevant page */}
      <section className="ops-stats-grid">
        <DashboardMetric
          label="Recommendations"
          value={suggestions.length}
          icon={<Sparkles />}
          detail="Open academic workflow items"
          href="/admin/workflows"
        />
        <DashboardMetric
          label="Urgent items"
          value={highUrgencyCount}
          icon={<FileWarning />}
          detail="High and critical priority"
          accent="danger"
          href="/admin/workflows"
        />
        <DashboardMetric
          label="Active workflows"
          value={activeWorkflowCount}
          icon={<ListChecks />}
          detail="Promoted for staff action"
          href="/admin/workflows"
        />
        <DashboardMetric
          label="Students enrolled"
          value={studentsCount}
          icon={<UsersRound />}
          detail="View and manage all records"
          href="/admin/students"
        />
      </section>

      <div className="admin-dashboard-grid">
        {/* Quick access — grouped by workflow area */}
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Quick Access</h2>
          </div>
          <div className="admin-quick-action-groups">
            {quickActionGroups.map((group) => (
              <div key={group.label} className="admin-quick-action-group">
                <div className="admin-quick-action-group-label">
                  <span>{group.label}</span>
                  <span className="admin-quick-action-group-desc">{group.description}</span>
                </div>
                <div className="admin-quick-actions">
                  {group.actions.map((action) => {
                    const { Icon } = action;
                    return (
                      <Link key={action.href} href={action.href} className="admin-quick-action">
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
            ))}
          </div>
        </div>

        {/* Recommendations summary — count + category breakdown + CTA */}
        <div className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Recommendations</h2>
            <Link href="/admin/workflows">Review all →</Link>
          </div>

          {suggestions.length === 0 ? (
            <p className="admin-signal-empty">No open recommendations at this time.</p>
          ) : (
            <>
              <div className="admin-rec-summary">
                <span className="admin-rec-count">{suggestions.length}</span>
                <span className="admin-rec-label">open items need staff review</span>
                {highUrgencyCount > 0 && (
                  <Badge variant="destructive" className="admin-rec-urgent">
                    {highUrgencyCount} urgent
                  </Badge>
                )}
              </div>

              <div className="admin-rec-breakdown">
                {byCategory.graduation > 0 && (
                  <Link href="/admin/workflows" className="admin-rec-category">
                    <span className="admin-rec-category-count">{byCategory.graduation}</span>
                    <span>Graduation readiness</span>
                    <ArrowRight size={13} />
                  </Link>
                )}
                {byCategory.progress > 0 && (
                  <Link href="/admin/workflows" className="admin-rec-category">
                    <span className="admin-rec-category-count">{byCategory.progress}</span>
                    <span>Academic progress</span>
                    <ArrowRight size={13} />
                  </Link>
                )}
                {byCategory.documentation > 0 && (
                  <Link href="/admin/workflows" className="admin-rec-category">
                    <span className="admin-rec-category-count">{byCategory.documentation}</span>
                    <span>Missing documentation</span>
                    <ArrowRight size={13} />
                  </Link>
                )}
                {byCategory.faculty > 0 && (
                  <Link href="/admin/faculty" className="admin-rec-category">
                    <span className="admin-rec-category-count">{byCategory.faculty}</span>
                    <span>Faculty assignment review</span>
                    <ArrowRight size={13} />
                  </Link>
                )}
              </div>

              <Link href="/admin/workflows" className="admin-rec-cta">
                Open workflow queue
                <ArrowRight size={14} />
              </Link>
            </>
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
  accent,
  href,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  detail: string;
  accent?: "danger" | "warn";
  href?: string;
}) {
  const content = (
    <Card className="ops-metric" data-accent={accent ?? "default"}>
      <CardContent>
        <div className="ops-metric-inner">
          <div className="ops-metric-label">{label}</div>
          <div className="ops-metric-value">{value}</div>
          <div className="ops-metric-detail">
            <span>{icon}</span>
            {detail}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  if (!href) return content;
  return (
    <Link href={href} className="ops-metric-link" aria-label={`${label} — open details`}>
      {content}
    </Link>
  );
}
