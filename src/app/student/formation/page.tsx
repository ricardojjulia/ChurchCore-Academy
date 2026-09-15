import { StudentPwaShell } from "@/components/student-pwa-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { requireActor } from "@/lib/require-actor";
import { withCapabilityContext } from "@/lib/capability-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import { getStudentFormationRecord } from "@/modules/ministry-formation/service";
import { Briefcase, Award, FileCheck } from "lucide-react";
import type { StudentFormationRecord } from "@/modules/ministry-formation/types";

export const dynamic = "force-dynamic";

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

  let record: StudentFormationRecord | null = null;
  let capabilityDisabled = false;
  let institutionName = "your institution";

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "ministryFormation");

      const [formationRecord, profileResult] = await Promise.all([
        getStudentFormationRecord(actor, actor.userId, client),
        client.query(
          "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
          [actor.tenantId]
        ) as Promise<{ rows: Array<{ institution_name?: string }> }>,
      ]);

      return {
        record: formationRecord as StudentFormationRecord | null,
        institutionName: profileResult.rows[0]?.institution_name ?? "your institution",
      };
    });

    record = result.record;
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

  if (capabilityDisabled) {
    return (
      <StudentPwaShell
        title="Ministry Formation"
        description="Your ministry formation journey records."
      >
        <CapabilityGhostPage
          capability="Ministry Formation"
          institutionModel={institutionName}
          actionHref="/student"
          actionLabel="Return to dashboard →"
        />
      </StudentPwaShell>
    );
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
                      <Badge variant="secondary">Endorsed</Badge>
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
                      <Badge variant="secondary">Endorsed</Badge>
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
                      <Badge variant="secondary">Endorsed</Badge>
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
