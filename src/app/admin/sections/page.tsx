import Link from "next/link";
import { BookOpen, CheckCircle2, Clock3, Layers3, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { fetchSectionRegistrationReview } from "@/lib/academy-read-models";
import { AcademyCourseCatalogRepository } from "@/modules/course-catalog/postgres-repository";
import type { CourseSection } from "@/modules/course-catalog/types";
import { SectionFormDialog } from "./SectionFormDialog";

export const dynamic = "force-dynamic";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

type RepoPool = {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
};

function titleize(s: string) {
  return s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function sectionStatusVariant(status: CourseSection["status"]): "default" | "secondary" | "outline" | "destructive" {
  if (status === "open" || status === "in_progress") return "secondary";
  if (status === "cancelled" || status === "archived") return "destructive";
  return "outline";
}

function instructorLabel(instructors: { personId: string; displayName: string }[], instructorId?: string) {
  if (!instructorId) return "Unassigned";
  return instructors.find((instructor) => instructor.personId === instructorId)?.displayName ?? "Unknown";
}

function periodLabel(periods: { id: string; name: string; academicYearName: string }[], periodId: string) {
  const period = periods.find((item) => item.id === periodId);
  return period ? `${period.name} · ${period.academicYearName}` : "Unknown period";
}

export default async function SectionsRosterPage() {
  const actor = await requireActor();

  const {
    sections,
    registrations,
    courseOptions,
    periodOptions,
    instructorOptions,
    subdivisionOptions,
  } = await withAcademyDatabaseContext(actor, async (client) => {
    const db = asAcademyDatabase<Queryable>(client);
    const catalog = await new AcademyCourseCatalogRepository(
      asAcademyDatabase<RepoPool>(client),
    ).fetchCourseCatalogConfiguration(actor.tenantId);
    const registrationRows = await fetchSectionRegistrationReview(actor.tenantId, client);
    const peopleResult = await db.query(
      `select staff.person_id, person.display_name
         from academy_staff_profiles staff
         join academy_people person
           on person.tenant_id = staff.tenant_id and person.id = staff.person_id
        where staff.tenant_id = $1 and staff.employment_status = 'active'
        order by person.display_name asc`,
      [actor.tenantId],
    );

    const yearById = new Map(catalog.academicYears.map((year) => [year.id, year.name]));

    return {
      sections: catalog.sections,
      registrations: registrationRows,
      courseOptions: catalog.courses
        .filter((course) => course.status !== "archived")
        .map((course) => ({ id: course.id, code: course.code, title: course.title })),
      periodOptions: catalog.academicPeriods
        .filter((period) => period.status !== "archived")
        .map((period) => ({
          id: period.id,
          name: period.name,
          academicYearName: yearById.get(period.academicYearId) ?? "Unknown year",
        })),
      instructorOptions: peopleResult.rows.map((row) => ({
        personId: String(row.person_id),
        displayName: String(row.display_name),
      })),
      subdivisionOptions: catalog.subdivisions
        .filter((subdivision) => subdivision.status !== "archived")
        .map((subdivision) => ({ id: subdivision.id, name: subdivision.name })),
    };
  });

  const courseById = new Map<string, { code: string; title: string }>(
    courseOptions.map((course) => [course.id, { code: course.code, title: course.title }]),
  );
  const registrationsBySection = new Map(
    sections.map((section) => [
      section.id,
      registrations.filter((registration) => registration.sectionId === section.id),
    ]),
  );
  const openSections = sections.filter((section) => section.status === "open" || section.status === "in_progress");
  const staffedSections = sections.filter((section) => section.primaryInstructorId);

  return (
    <AdminShell
      eyebrow="Academics"
      title="Sections & Roster"
      subtitle="Create sections, assign instructors, and review registration status."
      activeSection="academics"
    >
      <section className="sis-route-stats-grid">
        <MetricCard label="Sections" value={sections.length} detail="Scheduled offerings" icon={<Layers3 />} />
        <MetricCard label="Open" value={openSections.length} detail="Open or in progress" icon={<BookOpen />} />
        <MetricCard label="Staffed" value={staffedSections.length} detail="Primary instructor set" icon={<Users />} />
      </section>

      <Card className="sis-route-card">
        <CardHeader>
          <div className="sis-route-heading">
            <div className="sis-route-icon">
              <Layers3 />
            </div>
            <div>
              <CardTitle>Course Sections</CardTitle>
              <CardDescription>Scheduled offerings by period, instructor, delivery mode, and roster capacity.</CardDescription>
            </div>
            <SectionFormDialog
              mode="create"
              courses={courseOptions}
              periods={periodOptions}
              instructors={instructorOptions}
              subdivisions={subdivisionOptions}
            />
          </div>
        </CardHeader>
        <CardContent>
          {sections.length === 0 ? (
            <div className="sis-route-empty">
              <Layers3 />
              <span>No sections found for this tenant.</span>
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
                  <TableHead className="text-right">Roster</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => {
                  const course = courseById.get(section.courseId);
                  const sectionRegistrations = registrationsBySection.get(section.id) ?? [];
                  return (
                    <TableRow key={section.id}>
                      <TableCell>
                        <div className="font-mono font-semibold">{section.sectionCode}</div>
                        <div className="text-sm text-muted-foreground">{section.schedulePattern ?? "Schedule pending"}</div>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{course?.code ?? "Unknown"}</div>
                        <div className="text-sm text-muted-foreground">
                          {section.titleOverride ?? course?.title ?? "Unknown course"}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal text-sm">
                        {periodLabel(periodOptions, section.academicPeriodId)}
                      </TableCell>
                      <TableCell>{titleize(section.deliveryMode)}</TableCell>
                      <TableCell>{instructorLabel(instructorOptions, section.primaryInstructorId)}</TableCell>
                      <TableCell className="text-right">
                        {sectionRegistrations.length}/{section.capacity ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sectionStatusVariant(section.status)}>{titleize(section.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <SectionFormDialog
                          mode="edit"
                          section={section}
                          courses={courseOptions}
                          periods={periodOptions}
                          instructors={instructorOptions}
                          subdivisions={subdivisionOptions}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="sis-route-card">
        <CardHeader>
          <div className="sis-route-heading">
            <div className="sis-route-icon">
              <Users />
            </div>
            <div>
              <CardTitle>Registration Review</CardTitle>
              <CardDescription>Confirmed and pending student registrations grouped by section.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {sections.length === 0 ? (
            <div className="sis-route-empty">No sections available for registration review.</div>
          ) : (
            sections.map((section) => {
              const sectionRegistrations = registrationsBySection.get(section.id) ?? [];
              return (
                <div key={section.id} className="rounded-md border border-border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{section.sectionCode}</div>
                      <div className="text-sm text-muted-foreground">
                        {section.titleOverride ?? courseById.get(section.courseId)?.title ?? "Unknown course"}
                      </div>
                    </div>
                    <Badge variant="outline">{sectionRegistrations.length} registrations</Badge>
                  </div>
                  {sectionRegistrations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No confirmed or pending registrations yet.</p>
                  ) : (
                    <div className="grid gap-2">
                      {sectionRegistrations.map((registration) => (
                        <div
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
                          key={registration.id}
                        >
                          <div>
                            <Link
                              href={`/admin/students/${registration.studentProfileId}`}
                              className="font-medium text-foreground hover:underline"
                            >
                              {registration.studentName}
                            </Link>
                            <p className="text-sm text-muted-foreground">
                              {registration.studentNumber}
                              {registration.studentEmail ? ` · ${registration.studentEmail}` : ""}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                            {registration.status === "registered" ? (
                              <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
                            ) : (
                              <Clock3 size={14} strokeWidth={2} aria-hidden="true" />
                            )}
                            {registration.status.replaceAll("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
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
