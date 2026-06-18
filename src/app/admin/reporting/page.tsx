import { AdminShell } from "@/components/admin-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BarChart3, BookOpen, GraduationCap, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

export const dynamic = "force-dynamic";

interface GradeSummaryRow {
  course_section_id: string;
  student_count: number;
  avg_percentage: number | null;
}

export default async function ReportingPage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { actor, dataset } = await loadProtectedAcademyDataset();

  const gradeSummaries = await withAcademyDatabaseContext(actor, async (client) => {
    const result = await client.query(
      `select
         course_section_id::text,
         count(distinct student_person_id)             as student_count,
         round(avg(final_percentage_score)::numeric, 1) as avg_percentage
       from academy_gradebook_course_summaries
       where tenant_id = $1
       group by course_section_id`,
      [actor.tenantId],
    ) as { rows: GradeSummaryRow[] };
    return result.rows;
  });

  const sectionById = new Map(dataset.sections.map((s) => [s.id, s]));

  // Enrollment by status
  const enrollmentByStatus = dataset.students.reduce<Record<string, number>>((acc, s) => {
    acc[s.enrollmentStatus] = (acc[s.enrollmentStatus] ?? 0) + 1;
    return acc;
  }, {});

  // At-risk students: probation or pending_review status flags
  const atRisk = dataset.students.filter(
    (s) => s.statusFlag === "probation" || s.statusFlag === "pending_review",
  );

  // Section fill rates
  const sectionFill = dataset.sections.map((s) => ({
    id: s.id,
    code: s.code,
    title: s.title,
    rosterCount: s.rosterCount,
    rosterCapacity: s.rosterCapacity,
    fillRate: s.rosterCapacity > 0 ? Math.round((s.rosterCount / s.rosterCapacity) * 100) : 0,
  })).sort((a, b) => a.fillRate - b.fillRate);

  const lowFill = sectionFill.filter((s) => s.fillRate < 50);

  return (
    <AdminShell
      eyebrow="Reports"
      title="Reporting"
      subtitle="Enrollment counts, grade distribution, at-risk students, and section fill rates from real Academy data."
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      {/* Summary metrics */}
      <section className="ops-stats-grid">
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Total students</div>
            <div className="ops-metric-value">{dataset.students.length}</div>
            <div className="ops-metric-detail"><Users size={13} /> All statuses</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">At-risk</div>
            <div className="ops-metric-value">{atRisk.length}</div>
            <div className="ops-metric-detail"><TriangleAlert size={13} /> Probation or holds</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Sections</div>
            <div className="ops-metric-value">{dataset.sections.length}</div>
            <div className="ops-metric-detail"><BookOpen size={13} /> Active</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Low fill (&lt;50%)</div>
            <div className="ops-metric-value">{lowFill.length}</div>
            <div className="ops-metric-detail"><BarChart3 size={13} /> Under capacity</div>
          </CardContent>
        </div>
      </section>

      <div className="admin-dashboard-grid">
        {/* Enrollment by status */}
        <Card className="ops-panel">
          <CardHeader className="ops-card-header">
            <div className="ops-heading">
              <div className="ops-icon"><Users /></div>
              <div>
                <CardTitle>Enrollment by Status</CardTitle>
                <CardDescription>Student count grouped by enrollment status.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {Object.keys(enrollmentByStatus).length === 0 ? (
              <p className="admin-signal-empty">No student records found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(enrollmentByStatus)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => (
                      <TableRow key={status}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {status.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">{count}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* At-risk students */}
        <Card className="ops-panel">
          <CardHeader className="ops-card-header">
            <div className="ops-heading">
              <div className="ops-icon"><TriangleAlert /></div>
              <div>
                <CardTitle>At-Risk Students</CardTitle>
                <CardDescription>Students with academic probation or holds on record.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {atRisk.length === 0 ? (
              <p className="admin-signal-empty">No at-risk students detected.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status flag</TableHead>
                    <TableHead>Credits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atRisk.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.fullName}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="capitalize">
                          {s.statusFlag.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{s.creditsEarned}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grade distribution */}
      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><GraduationCap /></div>
            <div>
              <CardTitle>Grade Distribution by Section</CardTitle>
              <CardDescription>Average final percentage score per section from gradebook course summaries.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {gradeSummaries.length === 0 ? (
            <p className="admin-signal-empty">No grade summaries on record yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Students graded</TableHead>
                  <TableHead>Avg score</TableHead>
                  <TableHead>Standing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradeSummaries.map((row) => {
                  const section = sectionById.get(row.course_section_id);
                  const avg = row.avg_percentage != null ? Number(row.avg_percentage) : null;
                  return (
                    <TableRow key={row.course_section_id}>
                      <TableCell>
                        <span className="font-mono text-xs font-medium">{section?.code ?? row.course_section_id.slice(0, 8)}</span>
                        <span className="block text-xs text-muted-foreground">{section?.title ?? "—"}</span>
                      </TableCell>
                      <TableCell>{Number(row.student_count)}</TableCell>
                      <TableCell className="font-semibold">{avg != null ? `${avg}%` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={avg != null && avg >= 70 ? "secondary" : "destructive"}>
                          {avg == null ? "No data" : avg >= 90 ? "Excellent" : avg >= 70 ? "Passing" : "Below threshold"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section fill rates */}
      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><BarChart3 /></div>
            <div>
              <CardTitle>Section Fill Rates</CardTitle>
              <CardDescription>Roster fill rate for each section. Sorted by lowest fill first.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sectionFill.length === 0 ? (
            <p className="admin-signal-empty">No sections found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Fill rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionFill.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="font-mono text-xs font-medium">{s.code}</span>
                      <span className="block text-xs text-muted-foreground">{s.title}</span>
                    </TableCell>
                    <TableCell>{s.rosterCount}</TableCell>
                    <TableCell>{s.rosterCapacity}</TableCell>
                    <TableCell>
                      <Badge variant={s.fillRate >= 70 ? "secondary" : s.fillRate >= 50 ? "outline" : "destructive"}>
                        {s.fillRate}%
                      </Badge>
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
