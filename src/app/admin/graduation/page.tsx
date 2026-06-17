import Link from "next/link";
import { ArrowRight, CheckCircle2, GraduationCap, ShieldCheck, TriangleAlert } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";

export const dynamic = "force-dynamic";

function credentialLabel(credential: string) {
  const map: Record<string, string> = {
    certificate: "Certificate",
    diploma: "Diploma",
    associate: "Associate",
    bachelor: "Bachelor",
    master: "Master",
    doctorate: "Doctorate",
    continuing_education: "CE",
    non_credit: "Non-credit",
  };
  return map[credential] ?? credential;
}

export default async function GraduationPage() {
  const { dataset } = await loadProtectedAcademyDataset();

  const activeStudents = dataset.students.filter((s) => s.enrollmentStatus === "active");

  const candidateRows = activeStudents.map((student) => {
    const program = dataset.programs.find((p) => p.id === student.programId);
    const progressPct = program && program.requiredCredits > 0
      ? Math.min(100, Math.round((student.creditsEarned / program.requiredCredits) * 100))
      : null;
    const holds = student.graduationAdministrativeHolds;
    const readyToReview =
      student.allProgramCoursesCompleted ||
      (progressPct !== null && progressPct >= Math.round(dataset.thresholds.graduationCreditThreshold * 100));

    return { student, program, progressPct, holds, readyToReview };
  });

  const reviewReady = candidateRows.filter((r) => r.readyToReview && r.holds.length === 0);
  const withHolds = candidateRows.filter((r) => r.holds.length > 0);
  const inProgress = candidateRows.filter((r) => !r.readyToReview && r.holds.length === 0);

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Records"
      title="Graduation Audit"
      subtitle="Academic readiness, credit completion, holds, and registrar review entry points for graduation candidates."
    >
      <section className="ops-stats-grid">
        <MetricCard label="Active students" value={activeStudents.length} detail="Eligible for graduation review" icon={<GraduationCap />} />
        <MetricCard label="Review ready" value={reviewReady.length} detail="No holds, near or at credit threshold" icon={<CheckCircle2 />} />
        <MetricCard label="Administrative holds" value={withHolds.length} detail="Must be cleared before graduation" icon={<TriangleAlert />} />
        <MetricCard label="Credit threshold" value={`${Math.round(dataset.thresholds.graduationCreditThreshold * 100)}%`} detail="Required credit completion for review" icon={<ShieldCheck />} />
      </section>

      {reviewReady.length > 0 && (
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon"><CheckCircle2 /></div>
              <div>
                <CardTitle>Ready for Registrar Review</CardTitle>
                <CardDescription>Students at or above the credit threshold with no administrative holds.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CandidateTable rows={reviewReady} />
          </CardContent>
        </Card>
      )}

      {withHolds.length > 0 && (
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon"><TriangleAlert /></div>
              <div>
                <CardTitle>Holds Pending Clearance</CardTitle>
                <CardDescription>Administrative holds must be resolved before graduation can proceed.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CandidateTable rows={withHolds} showHolds />
          </CardContent>
        </Card>
      )}

      {inProgress.length > 0 && (
        <Card className="ops-panel">
          <CardHeader>
            <div className="ops-heading">
              <div className="ops-icon"><GraduationCap /></div>
              <div>
                <CardTitle>In Progress</CardTitle>
                <CardDescription>Active students still completing their program requirements.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CandidateTable rows={inProgress} />
          </CardContent>
        </Card>
      )}

      {activeStudents.length === 0 && (
        <Card className="ops-panel">
          <CardContent>
            <div className="student-empty-state">
              <ShieldCheck />
              <span>No active students found. Graduation review requires at least one active student record.</span>
              <Link href="/admin/students" className="academy-action-link">
                Open student records <ArrowRight />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}

type CandidateRow = {
  student: { id: string; fullName: string; email: string; creditsEarned: number; gpa?: number };
  program: { name: string; credential: string; requiredCredits: number } | undefined;
  progressPct: number | null;
  holds: string[];
  readyToReview: boolean;
};

function CandidateTable({ rows, showHolds }: { rows: CandidateRow[]; showHolds?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Program</TableHead>
          <TableHead>Credits</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>GPA</TableHead>
          {showHolds && <TableHead>Holds</TableHead>}
          <TableHead>Profile</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ student, program, progressPct, holds }) => (
          <TableRow key={student.id}>
            <TableCell className="whitespace-normal">
              <div className="font-medium">{student.fullName}</div>
              <div className="text-sm text-muted-foreground">{student.email}</div>
            </TableCell>
            <TableCell className="whitespace-normal">
              {program ? (
                <>
                  <div className="font-medium">{program.name}</div>
                  <Badge variant="outline" className="mt-1">{credentialLabel(program.credential)}</Badge>
                </>
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </TableCell>
            <TableCell>
              {student.creditsEarned}
              {program ? ` / ${program.requiredCredits}` : ""}
            </TableCell>
            <TableCell>
              {progressPct !== null ? (
                <Badge variant={progressPct >= 95 ? "secondary" : "outline"}>{progressPct}%</Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>{student.gpa ?? "—"}</TableCell>
            {showHolds && (
              <TableCell className="whitespace-normal">
                <div className="flex flex-wrap gap-1">
                  {holds.map((hold) => (
                    <Badge key={hold} variant="destructive" className="text-xs">{hold}</Badge>
                  ))}
                </div>
              </TableCell>
            )}
            <TableCell>
              <Link href={`/admin/students/${student.id}`} className="academy-action-link">
                Open record <ArrowRight />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: React.ReactNode }) {
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
