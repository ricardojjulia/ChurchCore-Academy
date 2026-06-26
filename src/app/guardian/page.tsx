import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Shield, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { getLinkedStudentsForGuardian } from "@/modules/people/guardian-access";

export const dynamic = "force-dynamic";

export default async function GuardianDashboardPage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const actor = await requireActor();

  const linkedStudents = await withAcademyDatabaseContext(actor, (client) =>
    getLinkedStudentsForGuardian(actor.userId, actor.tenantId, client),
  );

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
                return (
                  <div
                    key={ls.studentPersonId}
                    className="faculty-section-row"
                    style={{ padding: "1rem", background: "var(--surface-subtle, #f8f9fb)", borderRadius: "0.5rem" }}
                  >
                    <div>
                      <div className="font-medium">{ls.studentName}</div>
                      <div className="text-sm text-muted-foreground">
                        {ls.ferpaRestricted ? "Access restricted by registrar" : "Guardian-scoped records"}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      linked student
                    </Badge>
                    <Badge variant={ls.ferpaRestricted ? "outline" : "secondary"} className="capitalize">
                      {ls.ferpaRestricted ? "restricted" : "active"}
                    </Badge>
                    <Link
                      href={`/guardian/${ls.studentPersonId}`}
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
