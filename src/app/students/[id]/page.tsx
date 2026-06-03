import Link from "next/link";
import type React from "react";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AcademyShell } from "@/components/academy-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";
import { ShepherdAiSuggestion, WorkflowRecord } from "@/modules/shepherd-ai/types";

function formatCode(value: string) {
  return value.replaceAll("_", " ");
}

function urgencyVariant(urgency: string) {
  if (urgency === "critical" || urgency === "high") return "destructive";
  if (urgency === "medium") return "secondary";
  return "outline";
}

function statusVariant(status: string) {
  return status === "completed" || status === "good_standing" ? "secondary" : "outline";
}

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = academyDataset.students.find((item) => item.id === id);

  if (!student) {
    notFound();
  }

  const program = academyDataset.programs.find((item) => item.id === student.programId);
  const advisor = academyDataset.administrators.find((item) => item.id === student.advisorUserId);
  const evaluation = await runAcademicWorkflowEvaluationJob();
  const suggestions = evaluation.workflows.getStudentSuggestions(id);
  const workflows = evaluation.workflows.getStudentWorkflows(id);
  const progressPercent = program ? Math.min(100, Math.round((student.creditsEarned / program.requiredCredits) * 100)) : 0;
  const administrativeSignals = [
    ...student.missingEnrollmentSteps.map((value) => ({ category: "Enrollment", value })),
    ...student.documentationNotes.map((value) => ({ category: "Documentation", value })),
    ...student.transcriptAlerts.map((value) => ({ category: "Transcript", value })),
    ...student.recordAlerts.map((value) => ({ category: "Record", value })),
  ];

  return (
    <AcademyShell
      eyebrow="Student Profile"
      title={student.fullName}
      subtitle={`${program?.name ?? "Pending program assignment"} · ShepherdAI Insights use Academy SIS and academic-record data only.`}
      badge="Student record · registrar view"
    >
      <Card className="ops-panel student-identity-card">
        <CardContent>
          <div className="student-identity-layout">
            <div className="student-avatar">{student.fullName.split(" ").map((part) => part[0]).join("")}</div>
            <div className="student-identity-main">
              <div className="student-identity-kicker">Academic Record</div>
              <h2>{student.fullName}</h2>
              <p>{student.email}</p>
              <div className="student-badge-row">
                <Badge variant={statusVariant(student.statusFlag)} className="capitalize">
                  {formatCode(student.statusFlag)}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {formatCode(student.enrollmentStatus)}
                </Badge>
                <Badge variant="outline">{program?.name ?? "Program pending"}</Badge>
              </div>
            </div>
            <div className="student-identity-actions">
              <Link href="/workflows" className="academy-action-link">
                Open workflow queue
                <ArrowRight />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="ops-stats-grid">
        <StudentMetric label="Credits earned" value={student.creditsEarned} detail={`${progressPercent}% of required credits`} icon={<GraduationCap />} />
        <StudentMetric label="Expected credits" value={student.expectedCreditsByNow} detail="Academic pace benchmark" icon={<BookOpenCheck />} />
        <StudentMetric label="Open suggestions" value={suggestions.length} detail="Suggested Academic Workflows" icon={<Sparkles />} />
        <StudentMetric label="Active workflows" value={workflows.length} detail="Human-reviewed workflow items" icon={<ListChecks />} />
      </section>

      <Tabs defaultValue="insights" className="student-tabs">
        <TabsList className="student-tabs-list">
          <TabsTrigger value="insights">ShepherdAI Insights</TabsTrigger>
          <TabsTrigger value="record">Academic Record</TabsTrigger>
          <TabsTrigger value="signals">Administrative Signals</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
        </TabsList>

        <TabsContent value="insights">
          <Card className="ops-panel">
            <CardHeader className="ops-card-header">
              <div className="ops-heading">
                <div className="ops-icon">
                  <Sparkles />
                </div>
                <div>
                  <CardTitle>ShepherdAI Insights</CardTitle>
                  <CardDescription>Explainable academic workflow recommendations for registrar or advisor review.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="student-insight-list">
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No current ShepherdAI suggestions for this student.</p>
              ) : (
                suggestions.map((suggestion) => <SuggestionPanel key={suggestion.id} suggestion={suggestion} />)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="record">
          <section className="ops-content-grid">
            <Card className="ops-panel">
              <CardHeader>
                <CardTitle>Enrollment</CardTitle>
                <CardDescription>Administrative status and ownership fields.</CardDescription>
              </CardHeader>
              <CardContent className="student-field-list">
                <FieldRow label="Enrollment status" value={formatCode(student.enrollmentStatus)} />
                <FieldRow label="Program" value={program?.name ?? "Pending assignment"} />
                <FieldRow label="Advisor" value={advisor?.name ?? "Pending assignment"} />
                <FieldRow label="Active term" value={student.activeTerm ?? "Not active"} />
              </CardContent>
            </Card>

            <Card className="ops-panel">
              <CardHeader>
                <CardTitle>Academic Progress</CardTitle>
                <CardDescription>Credit pace and academic standing fields.</CardDescription>
              </CardHeader>
              <CardContent className="student-field-list">
                <FieldRow label="Credits earned" value={student.creditsEarned} />
                <FieldRow label="Transcript credits" value={student.transcriptCredits} />
                <FieldRow label="Required credits" value={program?.requiredCredits ?? "n/a"} />
                <FieldRow label="GPA" value={student.gpa ?? "Not tracked"} />
              </CardContent>
            </Card>

            <Card className="ops-panel">
              <CardHeader>
                <CardTitle>Documentation</CardTitle>
                <CardDescription>Required student record completion state.</CardDescription>
              </CardHeader>
              <CardContent>
                {student.missingDocuments.length === 0 ? (
                  <div className="student-empty-state">
                    <ShieldCheck />
                    <span>No missing required documents in this record.</span>
                  </div>
                ) : (
                  <div className="student-chip-list">
                    {student.missingDocuments.map((document) => (
                      <Badge key={document} variant="outline" className="capitalize">
                        {formatCode(document)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="signals">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Recent Administrative Signals</CardTitle>
              <CardDescription>Academy-only record details that may require staff review.</CardDescription>
            </CardHeader>
            <CardContent>
              {administrativeSignals.length === 0 ? (
                <div className="student-empty-state">
                  <ShieldCheck />
                  <span>No administrative signals are currently attached to this record.</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Signal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {administrativeSignals.map((signal) => (
                      <TableRow key={`${signal.category}-${signal.value}`}>
                        <TableCell>
                          <Badge variant="outline">{signal.category}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-normal">{signal.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows">
          <Card className="ops-panel">
            <CardHeader>
              <CardTitle>Academic Workflows</CardTitle>
              <CardDescription>Promoted workflow records connected to this student.</CardDescription>
            </CardHeader>
            <CardContent>
              {workflows.length === 0 ? (
                <div className="student-empty-state">
                  <ListChecks />
                  <span>No promoted workflows are currently attached to this student.</span>
                </div>
              ) : (
                <WorkflowTable workflows={workflows} suggestions={suggestions} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AcademyShell>
  );
}

function StudentMetric({
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

function SuggestionPanel({ suggestion }: { suggestion: ShepherdAiSuggestion }) {
  return (
    <div className="student-insight-card">
      <div className="student-insight-top">
        <div>
          <h3>{suggestion.title}</h3>
          <p>{suggestion.summary}</p>
        </div>
        <div className="student-insight-badges">
          <Badge variant={urgencyVariant(suggestion.urgency)} className="capitalize">
            {suggestion.urgency}
          </Badge>
          <Badge variant="outline">{suggestion.confidenceScore}%</Badge>
        </div>
      </div>
      <Separator />
      <div className="student-insight-grid">
        <InsightBlock title="Why this surfaced" icon={<AlertTriangle />} items={suggestion.explanation.whySurfaced} />
        <InsightBlock title="Suggested next steps" icon={<ClipboardList />} items={suggestion.suggestedActions.map((action) => action.label)} />
        <InsightBlock title="Boundary note" icon={<ShieldCheck />} items={[suggestion.boundaryNote]} />
      </div>
    </div>
  );
}

function InsightBlock({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <div className="student-insight-block">
      <div className="student-insight-block-title">
        {icon}
        {title}
      </div>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="student-field-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WorkflowTable({ workflows, suggestions }: { workflows: WorkflowRecord[]; suggestions: ShepherdAiSuggestion[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Workflow</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead>Due</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workflows.map((workflow) => {
          const suggestion = suggestions.find((item) => item.id === workflow.suggestionId);
          return (
            <TableRow key={workflow.id}>
              <TableCell className="whitespace-normal">
                <div className="font-medium">{suggestion?.title ?? formatCode(workflow.workflowCode)}</div>
                <div className="line-clamp-1 text-sm text-muted-foreground">{suggestion?.summary ?? "Workflow promoted from ShepherdAI suggestion."}</div>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(workflow.status)} className="capitalize">
                  {workflow.status}
                </Badge>
              </TableCell>
              <TableCell>{workflow.assignedToUserId ?? "Unassigned"}</TableCell>
              <TableCell>{workflow.dueAt ? new Date(workflow.dueAt).toLocaleDateString("en-US") : "Not set"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
