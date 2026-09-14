import Link from "next/link";
import { Users, Award, Briefcase, FileCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { requireActor } from "@/lib/require-actor";
import { withCapabilityContext } from "@/lib/capability-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import { listStudentsWithFormationSummary } from "@/modules/ministry-formation/service";

export const dynamic = "force-dynamic";

export default async function FormationListPage() {
  const actor = await requireActor();

  let students: Awaited<ReturnType<typeof listStudentsWithFormationSummary>> | undefined;
  let capabilityDisabled = false;
  let institutionName = "your institution";

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "ministryFormation");

      // Fetch institution name for ghost page
      const profileResult = (await client.query(
        "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
        [actor.tenantId]
      )) as { rows: Array<{ institution_name?: string }> };
      const fetchedInstitutionName = profileResult.rows[0]?.institution_name;

      const studentList = await listStudentsWithFormationSummary(actor, client);

      return {
        students: studentList,
        institutionName: fetchedInstitutionName ?? "your institution",
      };
    });

    students = result.students;
    institutionName = result.institutionName;
  } catch (error) {
    if (error instanceof CapabilityDisabledError) {
      capabilityDisabled = true;
      // Fetch institution name even when capability is disabled, for the ghost page
      try {
        institutionName = await withAcademyDatabaseContext(actor, async (client) => {
          const profileResult = (await client.query(
            "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
            [actor.tenantId]
          )) as { rows: Array<{ institution_name?: string }> };
          return profileResult.rows[0]?.institution_name ?? "your institution";
        });
      } catch {
        // Fallback to default if fetch fails
      }
    } else {
      throw error;
    }
  }

  if (capabilityDisabled || !students) {
    return (
      <AdminShell
        activeSection="records"
        eyebrow="Ministry Formation"
        title="Ministry Formation Records"
        subtitle="Practicum sessions, faith milestones, formation evaluations, and formation advisor assignments for ministry preparation students."
      >
        <CapabilityGhostPage capability="Ministry Formation" institutionModel={institutionName} />
      </AdminShell>
    );
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
                        className="text-sm font-semibold text-accent hover:underline"
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
