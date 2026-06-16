import Link from "next/link";
import type React from "react";
import { BookOpenCheck, ClipboardCheck, FileWarning, GraduationCap, ListChecks, Sparkles, TriangleAlert, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AcademyShell } from "@/components/academy-shell";
import { Card, CardContent } from "@/components/ui/card";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getInstitutionProfile } from "@/lib/institution";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function isSeedDataUnavailableError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("is not seeded");
}
export default async function Home() {
  const user = await getCurrentUser();
  const tenantId = user?.tenantId ?? "cca-main";
  const institution = await getInstitutionProfile(tenantId);

  const badgeText = `${institution?.institutionName ?? "Academy"} · ${user?.role ?? "admin"}`;

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  let evaluation: Awaited<ReturnType<typeof runAcademicWorkflowEvaluationJob>> | null = null;
  let seedDataWarning: string | null = null;

  try {
    evaluation = await runAcademicWorkflowEvaluationJob((await headers()).get("x-academy-tenant-id") ?? tenantId);
  } catch (error) {
    if (!isSeedDataUnavailableError(error)) {
      throw error;
    }

    seedDataWarning = "Academy dataset is not seeded for this tenant yet. Metrics remain hidden until seeding completes.";
  }

  const suggestions = evaluation?.suggestions ?? [];
  const workflows = evaluation?.repository.workflows ?? [];
  const studentsCount = evaluation?.dataset.students.length ?? 0;
  const programsCount = evaluation?.dataset.programs.length ?? 0;
  const facultyCount = evaluation?.dataset.faculty.length ?? 0;

  const highUrgencyCount = suggestions.filter((item) => item.urgency === "high" || item.urgency === "critical").length;
  const activeWorkflowCount = workflows.filter((workflow) => workflow.status !== "completed").length;
  const missingDocumentationCount = suggestions.filter((item) => item.workflowCode === "missing_documentation_review").length;

  return (
    <AcademyShell
      eyebrow="ChurchCore Academy"
      title="Academic Dashboard"
      subtitle="Faith-based education management for students, academic records, grading, faculty workflows, and institutional operations."
      badge={badgeText}
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      {evaluation ? (
        <>
          <section className="ops-stats-grid">
            <DashboardMetric
              label="ShepherdAI Recommendations"
              value={suggestions.length}
              icon={<Sparkles />}
              detail="Open details"
              bars={[3, 5, 4, 7, suggestions.length]}
              href="/workflows"
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
              value={missingDocumentationCount}
              icon={<ClipboardCheck />}
              detail="Record completion review"
              bars={[1, 1, 2, 2, missingDocumentationCount]}
              accent="warn"
            />
          </section>

          <section className="ops-stats-grid">
            <DashboardMetric label="Students evaluated" value={studentsCount} icon={<UsersRound />} detail="Tenant-scoped runtime dataset" bars={[2, 3, 3, 4, studentsCount]} />
            <DashboardMetric label="Programs" value={programsCount} icon={<GraduationCap />} detail="Tracked academic programs" bars={[1, 2, 2, 3, programsCount]} />
            <DashboardMetric label="Faculty records" value={facultyCount} icon={<BookOpenCheck />} detail="Load and advisor review" bars={[1, 2, 3, 3, facultyCount]} />
            <DashboardMetric label="Signal categories" value={5} icon={<Sparkles />} detail="Enrollment, records, progress, transcripts, faculty" bars={[3, 4, 4, 5, 5]} />
          </section>
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
              <p className="ops-empty-copy">{seedDataWarning ?? "Academy runtime data is unavailable for this tenant."}</p>
              <div className="ops-empty-actions">
                <Link href="/platform/control" className="academy-action-link">Open Platform Control</Link>
                <Link href="/settings/institution" className="academy-action-link">Review Institution Setup</Link>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </AcademyShell>
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
            <div className="ops-metric-bars" data-accent={accent ?? "default"}>
              {bars.map((bar, i) => (
                <div
                  key={i}
                  className="ops-metric-bar"
                  style={{ height: `${Math.round((bar / max) * 100)}%` }}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="ops-metric-link" aria-label={`${label} - open details`}>
      {content}
    </Link>
  );
}
