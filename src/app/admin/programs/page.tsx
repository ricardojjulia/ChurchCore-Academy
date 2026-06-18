import Link from "next/link";
import { ArrowRight, BookOpenCheck, GraduationCap, ShieldCheck, UsersRound } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";

export const dynamic = "force-dynamic";

function formatCode(value: string) {
  return value.replaceAll("_", " ");
}

export default async function ProgramsPage() {
  const { dataset } = await loadProtectedAcademyDataset();
  const activeStudents = dataset.students.filter((student) => student.enrollmentStatus === "active");
  const assignedStudents = dataset.students.filter((student) => Boolean(student.programId));

  return (
    <AdminShell
      activeSection="academics"
      eyebrow="Programs"
      title="Program Index"
      subtitle="Program, cohort, credit requirement, and student-progress entry points for registrar and academic review."
    >
      <p className="ops-page-action-link">
        <Link href="/admin/programs/new" className="underline">Create new program →</Link>
      </p>

      <section className="ops-stats-grid">
        <ProgramIndexMetric label="Programs" value={dataset.programs.length} detail="Tracked academic programs" icon={<GraduationCap />} />
        <ProgramIndexMetric label="Assigned students" value={assignedStudents.length} detail="Students with program ownership" icon={<UsersRound />} />
        <ProgramIndexMetric label="Active students" value={activeStudents.length} detail="Current academic records" icon={<BookOpenCheck />} />
      </section>

      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Program Readiness</CardTitle>
          <CardDescription>
            Open a program panel for graduation readiness, academic progress, and requirement review summaries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dataset.programs.length === 0 ? (
            <div className="student-empty-state">
              <ShieldCheck />
              <span>No programs exist for this tenant yet. Configure courses and programs before reviewing progress.</span>
              <Link href="/admin/settings/courses" className="academy-action-link">
                Open course settings
                <ArrowRight />
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Credential</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Required credits</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataset.programs.map((program) => {
                  const programStudents = dataset.students.filter((student) => student.programId === program.id);
                  const activeProgramStudents = programStudents.filter((student) => student.enrollmentStatus === "active");

                  return (
                    <TableRow key={program.id}>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{program.name}</div>
                        <div className="text-sm text-muted-foreground">{program.id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {formatCode(program.credential)}
                        </Badge>
                      </TableCell>
                      <TableCell>{program.cohortLabel}</TableCell>
                      <TableCell>{program.requiredCredits}</TableCell>
                      <TableCell>
                        {activeProgramStudents.length} active / {programStudents.length} assigned
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/programs/${program.id}`} className="academy-action-link">
                          Open program
                          <ArrowRight />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

function ProgramIndexMetric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="ops-metric">
      <CardContent>
        <div className="ops-metric-label">{label}</div>
        <div className="ops-metric-value">{value}</div>
        <div className="ops-metric-detail">
          <span>{icon}</span>
          {detail}
        </div>
      </CardContent>
    </Card>
  );
}
