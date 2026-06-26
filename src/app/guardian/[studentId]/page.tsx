import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { BookOpen, CreditCard, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { fetchGuardianStudentSummary } from "@/modules/people/guardian-access";

export const dynamic = "force-dynamic";

export default async function GuardianStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const actor = await requireActor();

  const summary = await withAcademyDatabaseContext(actor, (client) =>
    fetchGuardianStudentSummary(actor.userId, studentId, actor.tenantId, client),
  );

  if (summary === null) {
    return (
      <AdminShell
        eyebrow="Guardian Portal"
        title="Record Access Restricted"
        subtitle="Access to this student's records has been restricted by the institution."
        userEmail={user?.email}
        signOutAction={signOutAction}
      >
        <p className="ops-page-action-link">
          <Link href="/guardian" className="underline">← Back to My Students</Link>
        </p>
        <Card className="ops-panel">
          <CardContent>
            <p>Contact the registrar if you believe this restriction is incorrect.</p>
          </CardContent>
        </Card>
      </AdminShell>
    );
  }

  if (!summary) {
    notFound();
  }

  return (
    <AdminShell
      eyebrow="Guardian Portal"
      title={summary.studentName}
      subtitle="Guardian-scoped records. Contact the institution for any record changes."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <p className="ops-page-action-link">
        <Link href="/guardian" className="underline">← Back to My Students</Link>
      </p>

      <section className="ops-stats-grid">
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Attendance sections</div>
            <div className="ops-metric-value">{summary.attendance.length}</div>
            <div className="ops-metric-detail">
              <ShieldCheck size={13} />
              Guardian scoped
            </div>
          </CardContent>
        </div>
        {summary.grades?.cumulativeGpa != null && (
          <div className="ops-metric">
            <CardContent>
              <div className="ops-metric-label">GPA</div>
              <div className="ops-metric-value">{summary.grades.cumulativeGpa.toFixed(2)}</div>
              <div className="ops-metric-detail"><ShieldCheck size={13} /> Released records</div>
            </CardContent>
          </div>
        )}
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Balance</div>
            <div className="ops-metric-value" style={{ fontSize: "1rem" }}>{summary.balanceCents == null ? "Restricted" : `$${(summary.balanceCents / 100).toFixed(2)}`}</div>
            <div className="ops-metric-detail">
              <CreditCard size={13} />
              View only
            </div>
          </CardContent>
        </div>
      </section>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><BookOpen /></div>
            <div>
              <CardTitle>Attendance</CardTitle>
              <CardDescription>Section attendance summary without teacher notes.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="student-field-list">
          {summary.attendance.length === 0 ? (
            <p>No attendance records are available yet.</p>
          ) : summary.attendance.map((row) => (
            <div className="student-field-row" key={row.sectionId}>
              <span>{row.sectionName}</span>
              <strong>
                Present {row.presentCount} · Absent {row.absentCount} · Late {row.lateCount}
              </strong>
            </div>
          ))}
        </CardContent>
      </Card>

      {summary.grades && (
        <Card className="ops-panel">
          <CardHeader className="ops-card-header">
            <div className="ops-heading">
              <div className="ops-icon"><BookOpen /></div>
              <div>
                <CardTitle>Posted Grades</CardTitle>
                <CardDescription>Official posted grades only. Drafts are not shown.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="student-field-list">
            {summary.grades.postedGrades.length === 0 ? (
              <p>No posted grades are available yet.</p>
            ) : summary.grades.postedGrades.map((grade) => (
              <div className="student-field-row" key={`${grade.courseCode}-${grade.grade}`}>
                <span>{grade.courseCode} — {grade.courseTitle}</span>
                <strong>{grade.grade}</strong>
              </div>
            ))}
            <div className="student-field-row">
              <span>Cumulative GPA</span>
              <strong>{summary.grades.cumulativeGpa?.toFixed(2) ?? "Not posted"}</strong>
            </div>
          </CardContent>
        </Card>
      )}

      {!summary.ferpaRights && (
        <Card className="ops-panel">
          <CardContent>
            <Badge variant="outline">Limited access</Badge>
            <p>Your access to this student&apos;s records is limited. Contact the institution for details.</p>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}
