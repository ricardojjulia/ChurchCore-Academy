import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Shield, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireActor } from "@/lib/require-actor";
import { fetchStudentRecords } from "@/lib/academy-read-models";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

export const dynamic = "force-dynamic";

interface LinkedStudent {
  student_person_id: string;
  display_name: string;
  email: string;
  relationship_type: string;
  authority: string;
}

export default async function GuardianDashboardPage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const actor = await requireActor();

  const [students, linkedStudents] = await Promise.all([
    withAcademyDatabaseContext(actor, (client) => fetchStudentRecords(actor.tenantId, client)),
    withAcademyDatabaseContext(actor, async (client) => {
      const result = await client.query(
        `select
           sr.student_person_id,
           p.display_name,
           p.email,
           sr.relationship_type,
           sr.authority
         from academy_student_relationships sr
         join academy_people p on p.id = sr.student_person_id and p.tenant_id = sr.tenant_id
         where sr.tenant_id = $1
           and sr.related_person_id = $2
           and sr.status = 'active'
         order by p.display_name`,
        [actor.tenantId, actor.userId],
      ) as { rows: LinkedStudent[] };
      return result.rows;
    }),
  ]);

  const studentById = new Map(students.map((s) => [s.id, s]));

  return (
    <AdminShell
      eyebrow="Guardian Portal"
      title="My Students"
      subtitle="Students linked to your account. Contact the institution to update guardian relationships."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <section className="ops-stats-grid">
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Linked students</div>
            <div className="ops-metric-value">{linkedStudents.length}</div>
            <div className="ops-metric-detail"><Users size={13} /> Active relationships</div>
          </CardContent>
        </div>
      </section>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><Shield /></div>
            <div>
              <CardTitle>Linked Students</CardTitle>
              <CardDescription>Students you are authorized to view progress for.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {linkedStudents.length === 0 ? (
            <div className="student-empty-state">
              <Users />
              <span>No students are currently linked to your account. Contact your institution&apos;s registrar to establish guardian relationships.</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {linkedStudents.map((ls) => {
                const record = studentById.get(ls.student_person_id);
                return (
                  <div
                    key={ls.student_person_id}
                    className="faculty-section-row"
                    style={{ padding: "1rem", background: "var(--surface-subtle, #f8f9fb)", borderRadius: "0.5rem" }}
                  >
                    <div>
                      <div className="font-medium">{ls.display_name}</div>
                      <div className="text-sm text-muted-foreground">{ls.email}</div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {ls.relationship_type.replaceAll("_", " ")}
                    </Badge>
                    {record && (
                      <Badge variant={record.enrollmentStatus === "active" ? "secondary" : "outline"} className="capitalize">
                        {record.enrollmentStatus.replaceAll("_", " ")}
                      </Badge>
                    )}
                    <Link
                      href={`/guardian/${ls.student_person_id}`}
                      className="faculty-grade-link"
                    >
                      View progress →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
