import Link from "next/link";
import { ArrowRight, FileWarning, GraduationCap, ShieldCheck, UsersRound } from "lucide-react";
import { AcademyShell } from "@/components/academy-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";

export const dynamic = "force-dynamic";

function formatCode(value: string) {
  return value.replaceAll("_", " ");
}

function statusVariant(status: string) {
  if (status === "active" || status === "good_standing") return "secondary";
  if (status === "probation" || status === "pending_review") return "destructive";
  return "outline";
}

export default async function StudentsPage() {
  const { dataset } = await loadProtectedAcademyDataset();
  const activeStudents = dataset.students.filter((student) => student.enrollmentStatus === "active");
  const reviewStudents = dataset.students.filter(
    (student) =>
      student.missingEnrollmentSteps.length > 0 ||
      student.missingDocuments.length > 0 ||
      student.transcriptAlerts.length > 0 ||
      student.recordAlerts.length > 0,
  );

  return (
    <AcademyShell
      activeHref="/students"
      eyebrow="Students"
      title="Student Records"
      subtitle="Tenant-scoped student records, status, program assignment, and ShepherdAI review entry points."
      badge={`${dataset.institutionName} · ${dataset.students.length} records`}
    >
      <section className="ops-stats-grid">
        <StudentIndexMetric label="Total students" value={dataset.students.length} detail="Protected tenant records" icon={<UsersRound />} />
        <StudentIndexMetric label="Active students" value={activeStudents.length} detail="Currently active enrollment" icon={<GraduationCap />} />
        <StudentIndexMetric label="Needs review" value={reviewStudents.length} detail="Records, documentation, or transcript signals" icon={<FileWarning />} />
      </section>

      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Student Index</CardTitle>
          <CardDescription>
            Open a student profile for academic record details, administrative signals, and human-reviewed ShepherdAI workflow context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dataset.students.length === 0 ? (
            <div className="student-empty-state">
              <ShieldCheck />
              <span>No student records exist for this tenant yet. Start from admissions when applicant records are ready.</span>
              <Link href="/admissions" className="academy-action-link">
                Open admissions
                <ArrowRight />
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>GPA</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataset.students.map((student) => {
                  const program = dataset.programs.find((item) => item.id === student.programId);
                  const needsReview =
                    student.missingEnrollmentSteps.length +
                    student.missingDocuments.length +
                    student.transcriptAlerts.length +
                    student.recordAlerts.length;

                  return (
                    <TableRow key={student.id}>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{student.fullName}</div>
                        <div className="text-sm text-muted-foreground">{student.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-1">
                          <Badge variant={statusVariant(student.enrollmentStatus)} className="w-fit capitalize">
                            {formatCode(student.enrollmentStatus)}
                          </Badge>
                          <Badge variant={statusVariant(student.statusFlag)} className="w-fit capitalize">
                            {formatCode(student.statusFlag)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{program?.name ?? "Pending assignment"}</TableCell>
                      <TableCell>
                        {student.creditsEarned} / {program?.requiredCredits ?? student.expectedCreditsByNow}
                      </TableCell>
                      <TableCell>{student.gpa ?? "Not tracked"}</TableCell>
                      <TableCell>
                        <Link href={`/students/${student.id}`} className="academy-action-link">
                          Open record
                          <ArrowRight />
                        </Link>
                        {needsReview > 0 ? (
                          <div className="mt-2 text-xs text-muted-foreground">{needsReview} review signal{needsReview === 1 ? "" : "s"}</div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AcademyShell>
  );
}

function StudentIndexMetric({
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
