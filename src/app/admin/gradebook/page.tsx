import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, School } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { getDatabasePool } from "@/lib/database";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorForServerComponent } from "@/modules/academy-auth/request-context";

export const dynamic = "force-dynamic";

async function loadGradedCounts(tenantId: string): Promise<Map<string, number>> {
  const pool = getDatabasePool();
  const result = await pool.query<{ section_id: string; graded: string }>(
    `select
       a.course_section_id as section_id,
       count(distinct r.id) as graded
     from public.academy_gradebook_assignments a
     left join public.academy_gradebook_records r
       on r.tenant_id = a.tenant_id
      and r.assignment_id = a.id
     where a.tenant_id = $1
     group by a.course_section_id`,
    [tenantId],
  );
  return new Map(result.rows.map((r) => [r.section_id, parseInt(r.graded)]));
}

export default async function AdminGradebookPage() {
  const actor = await resolveAcademyActorForServerComponent();
  const { dataset } = await loadProtectedAcademyDataset();

  const gradedCounts = await withAcademyDatabaseContext(actor, () =>
    loadGradedCounts(actor.tenantId),
  );

  const people = dataset.peopleConfiguration?.people ?? [];
  const personById = new Map(people.map((p) => [p.id, p]));

  const sections = dataset.sections;
  const totalSections = sections.length;
  const sectionsWithGrades = sections.filter(
    (s) => (gradedCounts.get(s.id) ?? 0) > 0,
  ).length;
  const totalGraded = [...gradedCounts.values()].reduce((a, b) => a + b, 0);

  function resolveInstructor(instructorId?: string) {
    if (!instructorId) return "—";
    const p = personById.get(instructorId);
    return p?.displayName ?? instructorId;
  }

  return (
    <AdminShell
      activeSection="dailyops"
      eyebrow="Daily Ops"
      title="Gradebook"
      subtitle="Section-level grade progress and faculty entry links for all active course sections."
    >
      <section className="ops-stats-grid">
        <MetricCard label="Total sections" value={totalSections} icon={<School />} detail="Active course sections" />
        <MetricCard label="Sections with grades" value={sectionsWithGrades} icon={<CheckCircle2 />} detail="At least one grade recorded" />
        <MetricCard label="Total grade records" value={totalGraded} icon={<ClipboardCheck />} detail="Across all sections" />
        <MetricCard
          label="Sections pending"
          value={totalSections - sectionsWithGrades}
          icon={<BookOpen />}
          detail="No grades entered yet"
        />
      </section>

      <Card className="ops-panel">
        <CardHeader>
          <div className="ops-heading">
            <div className="ops-icon"><School /></div>
            <div>
              <CardTitle>Section Grade Status</CardTitle>
              <CardDescription>
                Click a section to open the faculty attendance and grade entry form.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <div className="student-empty-state">
              <BookOpen />
              <span>No course sections found for this tenant.</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Grades recorded</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => {
                  const graded = gradedCounts.get(section.id) ?? 0;
                  const hasGrades = graded > 0;
                  return (
                    <TableRow key={section.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {section.code}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {section.title}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {section.programId}
                      </TableCell>
                      <TableCell className="text-sm">
                        {resolveInstructor(section.instructorFacultyId)}
                      </TableCell>
                      <TableCell>{section.rosterCount}</TableCell>
                      <TableCell>{graded}</TableCell>
                      <TableCell>
                        <Badge variant={hasGrades ? "secondary" : "outline"}>
                          {hasGrades ? "In progress" : "Not started"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/faculty/attendance`}
                          className="academy-action-link"
                        >
                          Enter grades <ArrowRight />
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

function MetricCard({ label, value, icon, detail }: {
  label: string; value: string | number; icon: React.ReactNode; detail: string;
}) {
  return (
    <Card className="ops-metric">
      <CardContent>
        <div className="ops-metric-label">{label}</div>
        <div className="ops-metric-value">{value}</div>
        <div className="ops-metric-detail"><span>{icon}</span>{detail}</div>
      </CardContent>
    </Card>
  );
}
