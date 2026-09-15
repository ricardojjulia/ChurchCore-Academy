import { CheckCircle2, CircleDashed, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  StudentProgramProgressRequirement,
  StudentProgramProgressSummary,
} from "@/modules/student-program-progress/types";

function formatCode(value: string) {
  return value.replaceAll("_", " ");
}

function formatCredits(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function statusVariant(status: StudentProgramProgressRequirement["status"]) {
  if (status === "completed") return "secondary";
  if (status === "in_progress") return "outline";
  return "outline";
}

function StatusIcon({ status }: { status: StudentProgramProgressRequirement["status"] }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "in_progress") return <Clock3 className="h-4 w-4" />;
  return <CircleDashed className="h-4 w-4" />;
}

export function StudentProgramProgressCard({
  progress,
}: {
  progress?: StudentProgramProgressSummary;
}) {
  return (
    <Card className="ops-panel">
      <CardHeader>
        <CardTitle>Academic Progress</CardTitle>
        <CardDescription>
          Catalog-year curriculum progress from program membership, section registrations, and posted course summaries.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!progress ? (
          <div className="student-empty-state">
            <CircleDashed />
            <span>No active program membership with curriculum requirements is available for this student.</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <ProgressMetric label="Completed" value={formatCredits(progress.completedCredits)} detail={`${progress.percentComplete}%`} />
              <ProgressMetric label="In progress" value={formatCredits(progress.inProgressCredits)} detail="Credits underway" />
              <ProgressMetric label="Remaining" value={formatCredits(progress.remainingCredits)} detail="Credits left" />
              <ProgressMetric label="Required" value={formatCredits(progress.requiredCredits)} detail={progress.catalogAcademicYearName ?? "Catalog year"} />
            </div>

            {progress.requirements.length === 0 ? (
              <div className="student-empty-state">
                <CircleDashed />
                <span>No active curriculum requirements exist for this program catalog year.</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Requirement</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progress.requirements.map((requirement) => (
                    <TableRow key={requirement.requirementId}>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{requirement.courseCode ?? requirement.courseId}</div>
                        <div className="text-sm text-muted-foreground">{requirement.courseTitle ?? "Untitled course"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="capitalize">{formatCode(requirement.requirementType)}</div>
                        <div className="text-sm text-muted-foreground">{formatCode(requirement.requirementGroup)}</div>
                      </TableCell>
                      <TableCell>{formatCredits(requirement.credits)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(requirement.status)} className="gap-1 capitalize">
                          <StatusIcon status={requirement.status} />
                          {formatCode(requirement.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{requirement.finalLetterGrade ?? "n/a"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
