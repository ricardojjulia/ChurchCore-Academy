import Link from "next/link";
import { AlertTriangle, BookOpen, GraduationCap, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { SuggestionDetail, WorkflowRecordList } from "@/components/academy-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { requireActor } from "@/lib/require-actor";
import { canAccessShepherdAi, type AcademyRole } from "@/modules/academy-auth/policy";
import { InMemoryAcademicWorkflowRepository } from "@/modules/academic-workflows/repository";
import { resolveAcademicContext } from "@/modules/academic-calendar/user-context-repository";
import { fetchFacultyLoadWorkspace, type FacultyLoadDatabase } from "@/modules/people/faculty-load";
import { ShepherdAiPostgresRepository, type ShepherdAiDatabase } from "@/modules/shepherd-ai/postgres-repository";

export const dynamic = "force-dynamic";
export const FACULTY_LOAD_PAGE_ROLES: AcademyRole[] = ["institution_admin", "dean", "academic_admin"];

function number(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

export default async function FacultyPage() {
  const actor = await requireActor();
  requireActor(actor, FACULTY_LOAD_PAGE_ROLES);
  const canReadFacultySignals = canAccessShepherdAi(actor, actor.tenantId, "read");
  const { workspace, periodName, suggestions, workflows } = await withAcademyDatabaseContext(actor, async (client) => {
    const database = asAcademyDatabase<FacultyLoadDatabase>(client);
    const context = await resolveAcademicContext(actor.userId, actor.tenantId, database);
    const shepherdRepository = canReadFacultySignals
      ? new ShepherdAiPostgresRepository(asAcademyDatabase<ShepherdAiDatabase>(client))
      : null;
    const [allSuggestions, allWorkflows] = shepherdRepository
      ? await Promise.all([
        shepherdRepository.fetchSuggestions(actor.tenantId),
        shepherdRepository.fetchWorkflows(actor.tenantId),
      ])
      : [[], []];
    return {
      workspace: await fetchFacultyLoadWorkspace(actor, context.context.periodId, database),
      periodName: context.context.periodName,
      suggestions: allSuggestions.filter((suggestion) => (
        suggestion.workflowCode === "faculty_or_course_assignment_imbalance_review"
        && (suggestion.entityType === "faculty" || suggestion.entityType === "course_section")
      )),
      workflows: allWorkflows.filter((workflow) => workflow.workflowCode === "faculty_or_course_assignment_imbalance_review"),
    };
  });

  const assigned = workspace.faculty.filter((faculty) => faculty.sectionCount > 0);
  const totalSections = assigned.reduce((sum, faculty) => sum + faculty.sectionCount, 0);
  const totalSeats = assigned.reduce((sum, faculty) => sum + faculty.enrolledSeats, 0);
  const needingReview = workspace.faculty.filter((faculty) => faculty.reviewFlags.length > 0).length;
  const workflowRepository = new InMemoryAcademicWorkflowRepository(suggestions, workflows);

  return (
    <AdminShell activeSection="dailyops" eyebrow="Academic Operations" title="Faculty Teaching Load" subtitle={`${periodName ?? "No academic period selected"} · primary-instructor assignments and advising responsibility.`}>
      <section className="ops-stats-grid">
        <div className="faculty-stat"><span className="faculty-stat-icon"><Users /></span><span className="faculty-stat-value">{workspace.faculty.length}</span><span className="faculty-stat-label">Active faculty</span></div>
        <div className="faculty-stat"><span className="faculty-stat-icon"><BookOpen /></span><span className="faculty-stat-value">{totalSections}</span><span className="faculty-stat-label">Assigned sections</span></div>
        <div className="faculty-stat"><span className="faculty-stat-icon"><GraduationCap /></span><span className="faculty-stat-value">{totalSeats}</span><span className="faculty-stat-label">Enrolled seats</span></div>
        <div className="faculty-stat"><span className="faculty-stat-icon"><AlertTriangle /></span><span className="faculty-stat-value">{needingReview}</span><span className="faculty-stat-label">Review needed</span></div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Teaching and advising responsibilities</CardTitle>
          <CardDescription>Evidence from active primary-instructor assignments in the selected period. Flags identify records to review; they are not faculty evaluations.</CardDescription>
        </CardHeader>
        <CardContent>
          {!workspace.periodId ? (
            <div className="ops-empty-state"><p className="ops-empty-copy">Select an academic year and period to review faculty load.</p></div>
          ) : workspace.faculty.length === 0 ? (
            <div className="ops-empty-state"><p className="ops-empty-copy">No active faculty records are available for this institution.</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Faculty</TableHead><TableHead>Sections</TableHead><TableHead>Instruction</TableHead><TableHead>Enrollment</TableHead><TableHead>Advising</TableHead><TableHead>Review</TableHead></TableRow></TableHeader>
              <TableBody>{workspace.faculty.map((faculty) => (
                <TableRow key={faculty.personId}>
                  <TableCell><div className="font-medium">{faculty.facultyName}</div><div className="text-sm text-muted-foreground">{faculty.title} · {faculty.loadPolicy ? faculty.loadPolicy.replaceAll("_", " ") : "No load policy"}</div></TableCell>
                  <TableCell><div className="font-medium">{faculty.sectionCount}</div><div className="text-sm text-muted-foreground">{faculty.sections.length > 0 ? faculty.sections.map((section) => section.sectionCode).join(", ") : "None assigned"}</div></TableCell>
                  <TableCell><div>{number(faculty.instructionalCredits)} credits</div><div className="text-sm text-muted-foreground">{number(faculty.instructionalClockHours)} clock hours</div></TableCell>
                  <TableCell><div>{faculty.enrolledSeats}{faculty.capacity > 0 ? ` / ${faculty.capacity}` : ""} seats</div><div className="text-sm text-muted-foreground">{faculty.utilizationPercent == null ? "Capacity not configured" : `${faculty.utilizationPercent}% utilized`}</div></TableCell>
                  <TableCell>{faculty.adviseeCount} advisee{faculty.adviseeCount === 1 ? "" : "s"}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{faculty.reviewFlags.length === 0 ? <Badge variant="secondary">No flags</Badge> : faculty.reviewFlags.map((flag) => <Badge key={flag} variant="outline">{flag}</Badge>)}</div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canReadFacultySignals && (
        <section className="content-grid">
          <div className="stack">
            <section className="panel">
              <div className="section-heading"><h2 className="text-xl font-bold text-foreground">Faculty assignment imbalance alerts</h2></div>
              <div className="workflow-list">
                {suggestions.length === 0
                  ? <p className="text-sm text-muted-foreground">No active faculty assignment alerts.</p>
                  : suggestions.map((suggestion) => <SuggestionDetail key={suggestion.id} suggestion={suggestion} />)}
              </div>
            </section>
          </div>
          <div className="stack"><WorkflowRecordList workflows={workflows} repository={workflowRepository} /></div>
        </section>
      )}

      <div className="flex justify-end"><Link className="text-sm font-medium text-primary hover:underline" href="/admin/sections">Manage section assignments</Link></div>
    </AdminShell>
  );
}
