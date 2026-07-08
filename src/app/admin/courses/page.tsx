import Link from "next/link";
import { ArrowRight, BookOpen, BookOpenCheck, Clock, Layers3, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { AcademyCourseCatalogRepository } from "@/modules/course-catalog/postgres-repository";
import { resolveAcademicContext } from "@/modules/academic-calendar/user-context-repository";
import type { Course, CourseSection } from "@/modules/course-catalog/types";
import type { InstitutionSubdivision } from "@/modules/academic-calendar/types";
import { NewCourseButton } from "./course-actions";
import { NewSectionButton } from "./section-actions";
import { CourseRowActions } from "./CourseRowActions";

export const dynamic = "force-dynamic";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function titleize(s: string) {
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function durationLabel(course: Course) {
  const dur = course.defaultDuration;
  if (dur.durationUnit === "credit_hour") {
    const credits = course.defaultCredits ?? dur.creditHours ?? dur.durationValue;
    return `${credits} cr`;
  }
  if (dur.durationUnit === "clock_hour") {
    const hours = course.defaultClockHours ?? dur.clockHours ?? dur.durationValue;
    return `${hours} hrs`;
  }
  return `${dur.durationValue} ${dur.durationUnit.replace("_", " ")}`;
}

function subdivisionLabel(subdivisions: InstitutionSubdivision[], id?: string) {
  if (!id) return "—";
  return subdivisions.find((s) => s.id === id)?.name ?? "—";
}

function instructorLabel(people: { id: string; displayName: string }[], instructorId?: string) {
  if (!instructorId) return "Unassigned";
  return people.find((p) => p.id === instructorId)?.displayName ?? "Unknown";
}

function periodLabel(
  periods: { id: string; name: string; academicYearId: string }[],
  years: { id: string; name: string }[],
  section: CourseSection,
) {
  const periodObj = periods.find((p) => p.id === section.academicPeriodId);
  const period = periodObj?.name ?? "Unknown period";
  const year = periodObj ? (years.find((y) => y.id === periodObj.academicYearId)?.name ?? "") : "";
  return year ? `${period} · ${year}` : period;
}

function courseTypeVariant(status: Course["status"]): "default" | "secondary" | "outline" | "destructive" {
  if (status === "active") return "secondary";
  if (status === "archived") return "destructive";
  return "outline";
}

function sectionStatusVariant(status: CourseSection["status"]): "default" | "secondary" | "outline" | "destructive" {
  if (status === "open" || status === "in_progress") return "secondary";
  if (status === "cancelled" || status === "archived") return "destructive";
  return "outline";
}

type RepoPool = { query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }> };

export default async function CoursesPage() {
  const actor = await requireActor();

  const { catalog, people, selectedPeriodId } = await withAcademyDatabaseContext(actor, async (client) => {
    const db = asAcademyDatabase<Queryable>(client);

    const courseCatalog = await new AcademyCourseCatalogRepository(asAcademyDatabase<RepoPool>(client)).fetchCourseCatalogConfiguration(actor.tenantId);
    const peopleResult = await client.query(
      `select id::text, display_name as "displayName" from academy_people where tenant_id = $1`,
      [actor.tenantId],
    ) as { rows: { id: string; displayName: string }[] };
    const contextResult = await resolveAcademicContext(actor.userId, actor.tenantId, db);

    return {
      catalog: courseCatalog,
      people: peopleResult.rows,
      selectedPeriodId: contextResult.context.periodId,
    };
  });
  const { courses, sections, subdivisions, academicPeriods, academicYears } = catalog;

  const activeCourses = courses.filter((c) => c.status === "active");
  const scheduledSections = sections.filter((s) => {
    const isNotCancelledOrArchived = s.status !== "cancelled" && s.status !== "archived";
    const matchesPeriod = selectedPeriodId ? s.academicPeriodId === selectedPeriodId : true;
    return isNotCancelledOrArchived && matchesPeriod;
  });
  const staffedSections = scheduledSections.filter((s) => s.primaryInstructorId);
  const courseById = new Map(courses.map((c) => [c.id, c]));

  return (
    <AdminShell
      activeSection="academics"
      eyebrow="Academics"
      title="Course Catalog"
      subtitle="Active courses, scheduled sections, instructor assignments, and catalog readiness."
    >
      <section className="sis-route-stats-grid">
        <MetricCard label="Courses" value={activeCourses.length} detail="Active in catalog" icon={<BookOpen />} />
        <MetricCard label="Sections" value={scheduledSections.length} detail="Scheduled this term" icon={<Layers3 />} />
        <MetricCard label="Staffed" value={staffedSections.length} detail="Sections with instructors" icon={<Users />} />
        <MetricCard
          label="Duration types"
          value={new Set(courses.map((c) => c.defaultDuration.durationUnit)).size}
          detail="Credit, clock-hour, module…"
          icon={<Clock />}
        />
      </section>

      <Card className="sis-route-card">
        <CardHeader>
          <div className="sis-route-heading">
            <div className="sis-route-icon">
              <BookOpenCheck />
            </div>
            <div>
              <CardTitle>Courses</CardTitle>
              <CardDescription>All catalog courses across Bible school, children&apos;s school, seminary, and college programs.</CardDescription>
            </div>
            <NewCourseButton />
          </div>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <div className="sis-route-empty">
              <BookOpen />
              <span>No courses configured for this tenant.</span>
              <Link href="/admin/settings/courses" className="sis-route-action-link">
                Open course settings <ArrowRight />
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Subdivision</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-mono font-semibold">{course.code}</TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{course.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">{course.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{titleize(course.courseType)}</Badge>
                    </TableCell>
                    <TableCell>{titleize(course.courseLevel)}</TableCell>
                    <TableCell>{durationLabel(course)}</TableCell>
                    <TableCell>{subdivisionLabel(subdivisions, course.owningSubdivisionId)}</TableCell>
                    <TableCell>
                      <Badge variant={courseTypeVariant(course.status)}>{titleize(course.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <CourseRowActions course={course} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="sis-route-card">
        <CardHeader>
          <div className="sis-route-heading">
            <div className="sis-route-icon">
              <Layers3 />
            </div>
            <div>
              <CardTitle>Sections</CardTitle>
              <CardDescription>Scheduled offerings with period, instructor, and capacity assignments.</CardDescription>
            </div>
            <NewSectionButton
              courses={courses.map((c) => ({ id: c.id, code: c.code, title: c.title }))}
              periods={academicPeriods.map((p) => ({ id: p.id, name: p.name, academicYearId: p.academicYearId }))}
              years={academicYears.map((y) => ({ id: y.id, name: y.name }))}
              staff={people.map((p) => ({ personId: p.id, displayName: p.displayName }))}
            />
          </div>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <div className="sis-route-empty">
              <Layers3 />
              <span>No sections scheduled for this tenant.</span>
              <Link href="/admin/settings/courses" className="sis-route-action-link">
                Open course settings <ArrowRight />
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => {
                  const course = courseById.get(section.courseId);
                  return (
                    <TableRow key={section.id}>
                      <TableCell className="font-mono font-semibold">{section.sectionCode}</TableCell>
                      <TableCell className="whitespace-normal">
                        {course ? (
                          <>
                            <div className="font-medium">{course.code}</div>
                            <div className="text-sm text-muted-foreground">{section.titleOverride ?? course.title}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal text-sm">
                        {periodLabel(academicPeriods, academicYears, section)}
                      </TableCell>
                      <TableCell>{titleize(section.deliveryMode)}</TableCell>
                      <TableCell>{instructorLabel(people, section.primaryInstructorId)}</TableCell>
                      <TableCell>{section.capacity ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={sectionStatusVariant(section.status)}>{titleize(section.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="ops-action-row">
        <Link href="/admin/sections" className="sis-route-action-link">
          Roster view <ArrowRight />
        </Link>
        <Link href="/admin/settings/courses" className="sis-route-action-link">
          Full catalog review <ArrowRight />
        </Link>
      </div>
    </AdminShell>
  );
}

function MetricCard({ label, value, detail, icon }: { label: string; value: number; detail: string; icon: React.ReactNode }) {
  return (
    <Card className="sis-route-metric">
      <CardContent>
        <div className="sis-route-metric-label">{label}</div>
        <div className="sis-route-metric-value">{value}</div>
        <div className="sis-route-metric-detail">
          <span>{icon}</span>
          {detail}
        </div>
      </CardContent>
    </Card>
  );
}
