import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { BookOpen, GraduationCap, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireActor } from "@/lib/require-actor";
import { fetchStudentRecords, fetchProgramList } from "@/lib/academy-read-models";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

export const dynamic = "force-dynamic";

interface RelationshipCheck {
  relationship_type: string;
  authority: string;
}

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

  const [students, programs, relationship] = await Promise.all([
    withAcademyDatabaseContext(actor, (client) => fetchStudentRecords(actor.tenantId, client)),
    withAcademyDatabaseContext(actor, (client) => fetchProgramList(actor.tenantId, client)),
    withAcademyDatabaseContext(actor, async (client) => {
      const result = await client.query(
        `select relationship_type, authority
         from academy_student_relationships
         where tenant_id = $1
           and related_person_id = $2
           and student_person_id = $3
           and status = 'active'
         limit 1`,
        [actor.tenantId, actor.userId, studentId],
      ) as { rows: RelationshipCheck[] };
      return result.rows[0] ?? null;
    }),
  ]);

  if (!relationship) {
    notFound();
  }

  const student = students.find((s) => s.id === studentId);
  if (!student) {
    notFound();
  }

  const program = programs.find((p) => p.id === student.programId);
  const period = undefined as { startsOn?: string } | undefined;

  const progressPercent = program
    ? Math.min(100, Math.round((student.creditsEarned / program.requiredCredits) * 100))
    : 0;

  return (
    <AdminShell
      eyebrow="Guardian Portal"
      title={student.fullName}
      subtitle={`${program?.name ?? "Program pending"} — guardian view. Contact the institution for any record changes.`}
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <p className="ops-page-action-link">
        <Link href="/guardian" className="underline">← Back to My Students</Link>
      </p>

      <section className="ops-stats-grid">
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Credits earned</div>
            <div className="ops-metric-value">{student.creditsEarned}</div>
            <div className="ops-metric-detail">
              <GraduationCap size={13} />
              {progressPercent}% of required
            </div>
          </CardContent>
        </div>
        {student.gpa != null && (
          <div className="ops-metric">
            <CardContent>
              <div className="ops-metric-label">GPA</div>
              <div className="ops-metric-value">{student.gpa.toFixed(2)}</div>
              <div className="ops-metric-detail"><ShieldCheck size={13} /> Released records</div>
            </CardContent>
          </div>
        )}
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Your authority</div>
            <div className="ops-metric-value" style={{ fontSize: "1rem" }}>
              {relationship.authority.replaceAll("_", " ")}
            </div>
            <div className="ops-metric-detail">
              <ShieldCheck size={13} />
              {relationship.relationship_type.replaceAll("_", " ")}
            </div>
          </CardContent>
        </div>
      </section>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><BookOpen /></div>
            <div>
              <CardTitle>Academic Status</CardTitle>
              <CardDescription>Released academic record — view only.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="student-field-list">
          <div className="student-field-row">
            <span>Enrollment status</span>
            <strong>
              <Badge variant={student.enrollmentStatus === "active" ? "secondary" : "outline"} className="capitalize">
                {student.enrollmentStatus.replaceAll("_", " ")}
              </Badge>
            </strong>
          </div>
          <div className="student-field-row">
            <span>Academic standing</span>
            <strong>
              <Badge variant={student.statusFlag === "good_standing" ? "secondary" : "outline"} className="capitalize">
                {student.statusFlag.replaceAll("_", " ")}
              </Badge>
            </strong>
          </div>
          <div className="student-field-row">
            <span>Program</span>
            <strong>{program?.name ?? "Pending program assignment"}</strong>
          </div>
          {program && (
            <div className="student-field-row">
              <span>Credits required</span>
              <strong>{program.requiredCredits}</strong>
            </div>
          )}
          {period && (
            <div className="student-field-row">
              <span>Next period</span>
              <strong>{period.startsOn ?? "Not scheduled"}</strong>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
