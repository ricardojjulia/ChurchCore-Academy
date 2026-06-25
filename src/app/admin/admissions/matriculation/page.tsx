import Link from "next/link";
import { ArrowRight, CheckCircle2, GraduationCap, UserCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { requireActor } from "@/lib/require-actor";
import { fetchStudentRecords } from "@/lib/academy-read-models";
import {
  AdmissionsDatabase,
  PostgresAdmissionsRepository,
} from "@/modules/admissions/postgres-repository";

export const dynamic = "force-dynamic";

export default async function AdmissionsEnrollmentPage() {
  const actor = await requireActor();

  const { applications, students } = await withAcademyDatabaseContext(actor, async (client) => {
    const [apps, allStudents] = await Promise.all([
      new PostgresAdmissionsRepository(asAcademyDatabase<AdmissionsDatabase>(client)).list(actor.tenantId),
      fetchStudentRecords(actor.tenantId, client),
    ]);
    return { applications: apps, students: allStudents };
  });

  const accepted = applications.filter((a) => a.status === "accepted");

  // Determine which accepted applicants have an active enrollment
  const enrolledPersonIds = new Set(
    students
      .filter((s) => s.enrollmentStatus === "active")
      .map((s) => s.id),
  );

  const pendingAdmission = accepted.filter(
    (a) => !enrolledPersonIds.has(a.applicantPersonId),
  );
  const admitted = accepted.filter(
    (a) => enrolledPersonIds.has(a.applicantPersonId),
  );

  const studentById = new Map(students.map((s) => [s.id, s]));

  return (
    <AdminShell
      activeSection="admissions"
      eyebrow="Admissions"
      title="Admissions Enrollment"
      subtitle="Track accepted applicants through enrollment completion."
    >
      <section className="ops-stats-grid">
        <MetricCard label="Accepted" value={accepted.length} icon={<CheckCircle2 />} detail="Total accepted applicants" />
        <MetricCard label="Awaiting enrollment" value={pendingAdmission.length} icon={<UserCheck />} detail="Accepted but not yet enrolled" />
        <MetricCard label="Enrolled" value={admitted.length} icon={<GraduationCap />} detail="Accepted and enrolled" />
        <MetricCard
          label="Enrollment rate"
          value={accepted.length > 0 ? `${Math.round((admitted.length / accepted.length) * 100)}%` : "—"}
          icon={<GraduationCap />}
          detail="Of accepted applicants enrolled"
        />
      </section>

      {pendingAdmission.length > 0 && (
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon"><UserCheck /></div>
              <div>
                <CardTitle>Pending Enrollment</CardTitle>
                <CardDescription>Accepted applicants who have not yet been enrolled in a program.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Decided</TableHead>
                  <TableHead>Student record</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAdmission.map((app) => {
                  const student = studentById.get(app.applicantPersonId);
                  return (
                    <TableRow key={app.id}>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{app.legalName}</div>
                        <div className="text-sm text-muted-foreground">{app.email}</div>
                      </TableCell>
                      <TableCell>{app.programId}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {app.decidedAt ? new Date(app.decidedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        {student ? (
                          <Link href={`/admin/students/${student.id}`} className="academy-action-link">
                            Open record <ArrowRight />
                          </Link>
                        ) : (
                          <Badge variant="outline">No record yet</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {admitted.length > 0 && (
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon"><GraduationCap /></div>
              <div>
                <CardTitle>Enrolled</CardTitle>
                <CardDescription>Accepted applicants who are now enrolled students.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admitted.map((app) => {
                  const student = studentById.get(app.applicantPersonId);
                  return (
                    <TableRow key={app.id}>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{app.legalName}</div>
                        <div className="text-sm text-muted-foreground">{app.email}</div>
                      </TableCell>
                      <TableCell>{app.programId}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {student?.enrollmentStatus?.replace(/_/g, " ") ?? "enrolled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {student && (
                          <Link href={`/admin/students/${student.id}`} className="academy-action-link">
                            Open <ArrowRight />
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {accepted.length === 0 && (
        <Card className="ops-panel">
          <CardContent>
            <div className="student-empty-state">
              <GraduationCap />
              <span>No accepted applications yet.</span>
              <Link href="/admin/admissions/decisions" className="academy-action-link">
                Review pending decisions <ArrowRight />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}

function MetricCard({ label, value, icon, detail }: {
  label: string; value: string | number; icon: React.ReactNode; detail: string;
}) {
  return (
    <Card className="ops-metric">
      <CardContent>
        <div className="ops-metric-label">{label}</div>
        <div className="ops-metric-value">{value}</div>
        <div className="ops-metric-detail"><span>{icon}</span>{detail}</div>
      </CardContent>
    </Card>
  );
}
