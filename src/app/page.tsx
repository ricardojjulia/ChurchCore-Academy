import Link from "next/link";
import type React from "react";
import { ArrowRight, BookOpenCheck, ClipboardCheck, FileWarning, GraduationCap, ListChecks, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { AcademyShell } from "@/components/academy-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";

function formatCode(value: string) {
  return value.replaceAll("_", " ");
}

function urgencyVariant(urgency: string) {
  if (urgency === "critical" || urgency === "high") return "destructive";
  if (urgency === "medium") return "secondary";
  return "outline";
}

export default async function Home() {
  const { actor, dataset } = await loadProtectedAcademyDataset();
  const envStatus = {
    url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const evaluation = await runAcademicWorkflowEvaluationJob(
    actor.tenantId,
    dataset,
    null,
  );
  const widgetItems = evaluation.workflows.getDashboardWidget(5);
  const highUrgencyCount = evaluation.suggestions.filter((item) => item.urgency === "high" || item.urgency === "critical").length;
  const activeWorkflowCount = evaluation.repository.workflows.filter((workflow) => workflow.status !== "completed").length;
  const missingDocumentationCount = evaluation.suggestions.filter((item) => item.workflowCode === "missing_documentation_review").length;

  return (
    <AcademyShell
      eyebrow="ChurchCore Academy"
      title="Academic Dashboard"
      subtitle="Faith-based education management for students, academic records, grading, faculty workflows, and institutional operations."
      badge="Tenant view · academy-admin"
    >
      <section className="ops-stats-grid">
        <DashboardMetric
          label="Suggested workflows"
          value={evaluation.suggestions.length}
          icon={<Sparkles />}
          detail="Academy-only signals"
        />
        <DashboardMetric
          label="High urgency"
          value={highUrgencyCount}
          icon={<FileWarning />}
          detail="May require timely review"
        />
        <DashboardMetric
          label="Active workflows"
          value={activeWorkflowCount}
          icon={<ListChecks />}
          detail="Promoted for human action"
        />
        <DashboardMetric
          label="Documentation cases"
          value={missingDocumentationCount}
          icon={<ClipboardCheck />}
          detail="Record completion review"
        />
      </section>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon">
              <ListChecks />
            </div>
            <div>
              <CardTitle>Suggested Academic Workflows</CardTitle>
              <CardDescription>
                ShepherdAI Academy surfaces administrative recommendations for registrar, admissions, advisor, and academic admin review.
              </CardDescription>
            </div>
          </div>
          <Link href="/workflows" className="academy-action-link">
            Open queue
            <ArrowRight />
          </Link>
        </CardHeader>
        <CardContent>
          {widgetItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workflow suggestions are available yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {widgetItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-[42rem] whitespace-normal">
                      <div className="font-medium">{item.title}</div>
                      <div className="line-clamp-1 text-sm text-muted-foreground">{item.summary}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={urgencyVariant(item.urgency)} className="capitalize">
                        {item.urgency}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {formatCode(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {item.confidenceScore ? `${item.confidenceScore}%` : "n/a"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="ops-content-grid">
        <Card className="ops-panel">
          <CardHeader>
            <CardTitle>Academic Operations</CardTitle>
            <CardDescription>Core faith-based SIS and education-management workflow coverage.</CardDescription>
          </CardHeader>
          <CardContent className="ops-list">
            <OperationItem icon={<UsersRound />} title="Enrollment follow-up" detail="Admissions steps, advisor assignment, and registration completion." />
            <OperationItem icon={<ClipboardCheck />} title="Documentation review" detail="Required records, verification state, and registrar file completion." />
            <OperationItem icon={<GraduationCap />} title="Graduation readiness" detail="Credits, requirements, administrative holds, and review candidates." />
            <OperationItem icon={<BookOpenCheck />} title="Institution setup" detail="Academic years, terms, course types, grading, teachers, and LMS provider choice." />
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <CardTitle>Platform Readiness</CardTitle>
            <CardDescription>Local Supabase configuration for Academy development.</CardDescription>
          </CardHeader>
          <CardContent className="ops-list">
            <ReadinessRow label="Supabase URL" ready={envStatus.url} />
            <ReadinessRow label="Publishable key" ready={envStatus.publishableKey} />
            <ReadinessRow label="Service role key" ready={envStatus.serviceRoleKey} />
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader>
            <CardTitle>Boundary Guardrails</CardTitle>
            <CardDescription>ShepherdAI Academy remains product-specific and human-reviewed.</CardDescription>
          </CardHeader>
          <CardContent className="ops-list">
            <OperationItem icon={<ShieldCheck />} title="Academy-only data" detail="No Ops, Learning, Care, ministry, giving, counseling, or LMS engagement data." />
            <OperationItem icon={<ShieldCheck />} title="Deterministic decisions" detail="Scoring, triggers, transcript review, and graduation checks are rule-based." />
            <OperationItem icon={<ShieldCheck />} title="Human review" detail="Recommendations surface context and next steps; staff make official decisions." />
          </CardContent>
        </Card>
      </section>

      <section className="ops-stats-grid">
        <DashboardMetric label="Students evaluated" value={dataset.students.length} icon={<UsersRound />} detail="Persistent tenant records" />
        <DashboardMetric label="Programs" value={dataset.programs.length} icon={<GraduationCap />} detail="Tracked academic programs" />
        <DashboardMetric label="Faculty records" value={dataset.faculty.length} icon={<BookOpenCheck />} detail="Load and advisor review" />
        <DashboardMetric label="Signal categories" value={5} icon={<Sparkles />} detail="Enrollment, records, progress, transcripts, faculty" />
      </section>
    </AcademyShell>
  );
}

function DashboardMetric({
  label,
  value,
  icon,
  detail,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  detail: string;
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

function OperationItem({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="ops-list-item">
      <div className="ops-list-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="ops-readiness-row">
      <span>{label}</span>
      <Badge variant={ready ? "secondary" : "destructive"}>{ready ? "Configured" : "Missing"}</Badge>
    </div>
  );
}
