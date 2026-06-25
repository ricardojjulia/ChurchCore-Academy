import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, School } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withAcademyDatabaseContext, type AcademyQueryClient } from "@/lib/academy-database-context";
import { requireActor } from "@/lib/require-actor";
import { fetchSectionList } from "@/lib/academy-read-models";
import { postGradeAction } from "@/lib/actions/gradebook/postGradeAction";

export const dynamic = "force-dynamic";

interface PostingQueueRow {
  id: string;
  assignmentTitle: string;
  courseTitle: string;
  sectionCode: string | null;
  learnerDisplayName: string;
  pointsEarned: number | null;
  maxPoints: number;
  letterGrade: string | null;
  postingStatus: string;
}

async function loadGradedCounts(
  tenantId: string,
  client: AcademyQueryClient,
): Promise<Map<string, number>> {
  const result = await client.query(
    `select
       a.section_id as section_id,
       count(distinct r.id) as graded
     from public.academy_gradebook_assignments a
     left join public.academy_gradebook_records r
       on r.tenant_id = a.tenant_id
      and r.assignment_id = a.id
     where a.tenant_id = $1
     group by a.section_id`,
    [tenantId],
  ) as { rows: { section_id: string; graded: string }[] };
  return new Map(result.rows.map((r) => [r.section_id, parseInt(r.graded)]));
}

async function loadPostingQueue(
  tenantId: string,
  client: AcademyQueryClient,
): Promise<PostingQueueRow[]> {
  const result = await client.query(
    `select
       record.id,
       assignment.title as assignment_title,
       course.title as course_title,
       section.section_code,
       learner.display_name as learner_display_name,
       record.points_earned,
       record.max_points,
       record.letter_grade,
       record.posting_status
     from public.academy_gradebook_records record
     join public.academy_gradebook_assignments assignment
       on assignment.tenant_id = record.tenant_id
      and assignment.id = record.assignment_id
     join public.academy_courses course
       on course.tenant_id = assignment.tenant_id
      and course.id = assignment.course_id
     left join public.academy_course_sections section
       on section.tenant_id = assignment.tenant_id
      and section.id = assignment.section_id
     join public.academy_people learner
       on learner.tenant_id = record.tenant_id
      and learner.id = record.learner_person_id
     where record.tenant_id = $1
       and record.posting_status = 'draft'
     order by record.graded_at asc, learner.display_name asc
     limit 50`,
    [tenantId],
  ) as { rows: Record<string, unknown>[] };

  return result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    assignmentTitle: String(row.assignment_title),
    courseTitle: String(row.course_title),
    sectionCode: row.section_code != null ? String(row.section_code) : null,
    learnerDisplayName: String(row.learner_display_name),
    pointsEarned: row.points_earned != null ? Number(row.points_earned) : null,
    maxPoints: Number(row.max_points),
    letterGrade: row.letter_grade != null ? String(row.letter_grade) : null,
    postingStatus: String(row.posting_status),
  }));
}

export default async function AdminGradebookPage() {
  const actor = await requireActor();

  async function postGradeFormAction(formData: FormData) {
    "use server";
    const gradeRecordId = String(formData.get("gradeRecordId") ?? "");
    await postGradeAction({
      gradeRecordId,
      releaseToStudent: true,
      reason: "Registrar review completed from Admin Gradebook posting queue.",
    });
  }

  const { sections, people, gradedCounts, postingQueue } = await withAcademyDatabaseContext(
    actor,
    async (client) => {
      const sectionRows = await fetchSectionList(actor.tenantId, client);
      const result = await client.query(
        `select id::text, display_name as "displayName" from academy_people where tenant_id = $1`,
        [actor.tenantId],
      ) as { rows: { id: string; displayName: string }[] };
      const graded = await loadGradedCounts(actor.tenantId, client);
      const queue = await loadPostingQueue(actor.tenantId, client);
      return {
        sections: sectionRows,
        people: result.rows,
        gradedCounts: graded,
        postingQueue: queue,
      };
    },
  );

  const personById = new Map(people.map((p) => [p.id, p]));
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

      <Card className="ops-panel">
        <CardHeader>
          <div className="ops-heading">
            <div className="ops-icon"><ClipboardCheck /></div>
            <div>
              <CardTitle>Registrar Posting Queue</CardTitle>
              <CardDescription>
                Post reviewed faculty grades to official student-visible records.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {postingQueue.length === 0 ? (
            <div className="student-empty-state">
              <CheckCircle2 />
              <span>No draft grade records are waiting for registrar posting.</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Course / Section</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postingQueue.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.learnerDisplayName}</TableCell>
                    <TableCell>{record.assignmentTitle}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {record.courseTitle}
                      {record.sectionCode && <span className="ml-1 font-mono">· {record.sectionCode}</span>}
                    </TableCell>
                    <TableCell>
                      {record.pointsEarned !== null ? `${record.pointsEarned} / ${record.maxPoints}` : `— / ${record.maxPoints}`}
                    </TableCell>
                    <TableCell>{record.letterGrade ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.postingStatus}</Badge>
                    </TableCell>
                    <TableCell>
                      <form action={postGradeFormAction}>
                        <input type="hidden" name="gradeRecordId" value={record.id} />
                        <button type="submit" className="academy-action-link">
                          Post grade <ArrowRight />
                        </button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
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
