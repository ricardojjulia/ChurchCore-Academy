import Link from "next/link";
import { Users, Award, Briefcase, FileCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/require-actor";

export const dynamic = "force-dynamic";

interface FormationSummary {
  studentPersonId: string;
  fullName: string;
  email: string;
  totalPracticumHours: number;
  milestoneCount: number;
  evaluationCount: number;
  formationAdvisorPersonId?: string;
  formationAdvisorName?: string;
}

export default async function FormationListPage() {
  await requireActor();

  const requestHeaders = await (await import("next/headers")).headers();
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/academy/ministry-formation/students`,
    {
      headers: {
        cookie: requestHeaders.get("cookie") || "",
      },
    },
  );

  let students: FormationSummary[] = [];
  if (response.ok) {
    students = await response.json();
  }

  const totalHours = students.reduce((sum, s) => sum + s.totalPracticumHours, 0);
  const totalMilestones = students.reduce((sum, s) => sum + s.milestoneCount, 0);
  const totalEvaluations = students.reduce((sum, s) => sum + s.evaluationCount, 0);

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Ministry Formation"
      title="Ministry Formation Records"
      subtitle="Practicum sessions, faith milestones, formation evaluations, and formation advisor assignments for ministry preparation students."
    >
      <section className="ops-stats-grid">
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Students with records</div>
            <div className="ops-metric-value">{students.length}</div>
            <div className="ops-metric-detail">
              <Users size={13} /> Total
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Practicum hours</div>
            <div className="ops-metric-value">{totalHours}</div>
            <div className="ops-metric-detail">
              <Briefcase size={13} /> Logged
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Faith milestones</div>
            <div className="ops-metric-value">{totalMilestones}</div>
            <div className="ops-metric-detail">
              <Award size={13} /> Recorded
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Evaluations</div>
            <div className="ops-metric-value">{totalEvaluations}</div>
            <div className="ops-metric-detail">
              <FileCheck size={13} /> Completed
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon">
              <Users />
            </div>
            <div>
              <CardTitle>Students in Formation</CardTitle>
              <CardDescription>
                Showing {students.length} student{students.length !== 1 ? "s" : ""} with ministry formation records.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ministry formation records found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Practicum Hours</TableHead>
                  <TableHead>Milestones</TableHead>
                  <TableHead>Evaluations</TableHead>
                  <TableHead>Formation Advisor</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.studentPersonId}>
                    <TableCell className="font-medium">{student.fullName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.email || "—"}
                    </TableCell>
                    <TableCell>{student.totalPracticumHours}</TableCell>
                    <TableCell>{student.milestoneCount}</TableCell>
                    <TableCell>{student.evaluationCount}</TableCell>
                    <TableCell>
                      {student.formationAdvisorName ? (
                        <span className="text-sm">{student.formationAdvisorName}</span>
                      ) : (
                        <Badge variant="outline">Unassigned</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/formation/${student.studentPersonId}`}
                        className="text-sm font-semibold text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
