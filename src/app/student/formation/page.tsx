import { StudentPwaShell } from "@/components/student-pwa-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { requireActor } from "@/lib/require-actor";
import { Briefcase, Award, FileCheck } from "lucide-react";

export const dynamic = "force-dynamic";

interface PracticumSession {
  id: string;
  hours: number;
  siteName: string;
  supervisorName: string;
  sessionDate: string;
  reflectionNote?: string;
  status: "draft" | "endorsed";
  isTransferCredit: boolean;
  sourceInstitution?: string;
}

interface FaithMilestone {
  id: string;
  milestoneType: string;
  customTypeLabel?: string;
  milestoneDate: string;
  witnessNames?: string[];
  institutionNotes?: string;
  status: "draft" | "endorsed";
  isTransferCredit: boolean;
  sourceInstitution?: string;
}

interface FormationEvaluationStudentView {
  id: string;
  evaluatorNameSnapshot: string;
  rubricLabel: string;
  scores: Record<string, number>;
  status: "draft" | "endorsed";
  evaluationDate: string;
}

interface StudentFormationRecord {
  tenantId: string;
  studentPersonId: string;
  practicumSessions: PracticumSession[];
  milestones: FaithMilestone[];
  evaluations: FormationEvaluationStudentView[];
  formationAdvisorPersonId?: string;
  formationAdvisorName?: string;
}

const milestoneTypeLabels: Record<string, string> = {
  baptism: "Baptism",
  ordination: "Ordination",
  ministry_practicum_completion: "Ministry Practicum Completion",
  spiritual_formation_review: "Spiritual Formation Review",
  pastoral_endorsement: "Pastoral Endorsement",
  custom: "Custom",
};

export default async function StudentFormationPage() {
  const actor = await requireActor();

  const requestHeaders = await (await import("next/headers")).headers();
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/academy/ministry-formation/${actor.userId}`,
    {
      headers: {
        cookie: requestHeaders.get("cookie") || "",
      },
    },
  );

  let record: StudentFormationRecord | null = null;
  if (response.ok) {
    record = await response.json();
  }

  if (!record) {
    return (
      <StudentPwaShell
        title="Ministry Formation"
        description="Your ministry formation journey records."
      >
        <Card className="ops-panel">
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No ministry formation records are available yet.
            </p>
          </CardContent>
        </Card>
      </StudentPwaShell>
    );
  }

  const totalHours = record.practicumSessions.reduce((sum, s) => sum + s.hours, 0);

  function formatMilestoneType(type: string, customLabel?: string) {
    if (type === "custom" && customLabel) return customLabel;
    return milestoneTypeLabels[type] || type;
  }

  function formatScores(scores: Record<string, number>) {
    return Object.entries(scores)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  }

  return (
    <StudentPwaShell
      title="Ministry Formation"
      description="Your ministry formation journey records."
    >
      <section className="ops-stats-grid">
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
            <div className="ops-metric-label">Milestones</div>
            <div className="ops-metric-value">{record.milestones.length}</div>
            <div className="ops-metric-detail">
              <Award size={13} /> Recorded
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Evaluations</div>
            <div className="ops-metric-value">{record.evaluations.length}</div>
            <div className="ops-metric-detail">
              <FileCheck size={13} /> Completed
            </div>
          </CardContent>
        </Card>
      </section>

      {record.formationAdvisorName && (
        <Card className="ops-panel">
          <CardHeader>
            <CardTitle>Formation Advisor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="student-field-list">
              <div className="ops-readiness-row">
                <span>Your formation advisor</span>
                <strong>{record.formationAdvisorName}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Practicum Sessions</CardTitle>
          <CardDescription>
            {record.practicumSessions.length} session{record.practicumSessions.length !== 1 ? "s" : ""} · {totalHours} total hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          {record.practicumSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No practicum sessions recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Site / Activity</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.practicumSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="text-sm">{session.sessionDate}</TableCell>
                    <TableCell>{session.hours}</TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{session.siteName}</div>
                      {session.reflectionNote && (
                        <div className="text-sm text-muted-foreground">{session.reflectionNote}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{session.supervisorName}</TableCell>
                    <TableCell>
                      {session.status === "endorsed" ? (
                        <Badge variant="secondary">Endorsed</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Faith Milestones</CardTitle>
          <CardDescription>
            {record.milestones.length} milestone{record.milestones.length !== 1 ? "s" : ""} recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {record.milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Milestone Type</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.milestones.map((milestone) => (
                  <TableRow key={milestone.id}>
                    <TableCell className="text-sm">{milestone.milestoneDate}</TableCell>
                    <TableCell className="font-medium">
                      {formatMilestoneType(milestone.milestoneType, milestone.customTypeLabel)}
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm text-muted-foreground">
                      {milestone.institutionNotes || "—"}
                    </TableCell>
                    <TableCell>
                      {milestone.status === "endorsed" ? (
                        <Badge variant="secondary">Endorsed</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="ops-panel">
        <CardHeader>
          <CardTitle>Formation Evaluations</CardTitle>
          <CardDescription>
            {record.evaluations.length} evaluation{record.evaluations.length !== 1 ? "s" : ""} completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {record.evaluations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evaluations recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Evaluator</TableHead>
                  <TableHead>Rubric</TableHead>
                  <TableHead>Scores</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.evaluations.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell className="text-sm">{evaluation.evaluationDate}</TableCell>
                    <TableCell className="font-medium">{evaluation.evaluatorNameSnapshot}</TableCell>
                    <TableCell className="text-sm">{evaluation.rubricLabel}</TableCell>
                    <TableCell className="text-sm">{formatScores(evaluation.scores)}</TableCell>
                    <TableCell>
                      {evaluation.status === "endorsed" ? (
                        <Badge variant="secondary">Endorsed</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="ops-panel">
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Privacy notice: Ministry formation records shown here are released and reviewed. Draft records and staff-only notes are not displayed.
          </p>
        </CardContent>
      </Card>
    </StudentPwaShell>
  );
}
