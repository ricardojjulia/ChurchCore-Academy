import { AdminShell } from "@/components/admin-shell";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { ClipboardCheck, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

export const dynamic = "force-dynamic";

interface SectionAttendanceSummary {
  course_section_id: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  total_count: number;
}

export default async function AdminAttendancePage() {
  const user = await getCurrentUser();

  async function signOutAction() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const { actor, dataset } = await loadProtectedAcademyDataset();
  const sections = dataset.sections;

  const summaries = await withAcademyDatabaseContext(actor, async (client) => {
    const result = await client.query(
      `select
         course_section_id::text,
         count(*) filter (where status = 'present')  as present_count,
         count(*) filter (where status = 'absent')   as absent_count,
         count(*) filter (where status = 'late')     as late_count,
         count(*) filter (where status = 'excused')  as excused_count,
         count(*)                                     as total_count
       from academy_attendance_records
       where tenant_id = $1
       group by course_section_id`,
      [actor.tenantId],
    ) as { rows: SectionAttendanceSummary[] };
    return result.rows;
  });

  const summaryBySectionId = new Map(
    summaries.map((s) => [s.course_section_id, s]),
  );

  const totalRecords = summaries.reduce((sum, s) => sum + Number(s.total_count), 0);

  return (
    <AdminShell
      eyebrow="Daily Ops"
      title="Attendance"
      subtitle="Attendance records by section and student, entered by faculty."
      activeSection="dailyops"
      userEmail={user?.email}
      signOutAction={signOutAction}
    >
      <section className="ops-stats-grid">
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Sections</div>
            <div className="ops-metric-value">{sections.length}</div>
            <div className="ops-metric-detail"><BookOpen size={13} /> With roster</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Total records</div>
            <div className="ops-metric-value">{totalRecords}</div>
            <div className="ops-metric-detail"><ClipboardCheck size={13} /> All sessions</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Sections tracked</div>
            <div className="ops-metric-value">{summaries.length}</div>
            <div className="ops-metric-detail"><ClipboardCheck size={13} /> Have records</div>
          </CardContent>
        </div>
      </section>

      <div className="admin-dashboard-grid">
        <Card className="ops-panel">
          <CardHeader className="ops-card-header">
            <div className="ops-heading">
              <div className="ops-icon"><ClipboardCheck /></div>
              <div>
                <CardTitle>Faculty Attendance Entry</CardTitle>
                <CardDescription>Faculty members enter attendance via the Faculty Portal.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/faculty/attendance" className="faculty-grade-link">
              Open faculty attendance entry →
            </Link>
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader className="ops-card-header">
            <div className="ops-heading">
              <div className="ops-icon"><BookOpen /></div>
              <div>
                <CardTitle>Attendance by Section</CardTitle>
                <CardDescription>Aggregate present / absent / late counts per section.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sections.length === 0 ? (
              <p className="admin-signal-empty">No sections found for this tenant.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Section</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Excused</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sections.map((section) => {
                    const summary = summaryBySectionId.get(section.id);
                    return (
                      <TableRow key={section.id}>
                        <TableCell>
                          <span className="font-mono text-xs font-medium">{section.code}</span>
                          <span className="block text-xs text-muted-foreground">{section.title}</span>
                        </TableCell>
                        <TableCell>{summary ? Number(summary.present_count) : "—"}</TableCell>
                        <TableCell>{summary ? Number(summary.absent_count) : "—"}</TableCell>
                        <TableCell>{summary ? Number(summary.late_count) : "—"}</TableCell>
                        <TableCell>{summary ? Number(summary.excused_count) : "—"}</TableCell>
                        <TableCell>
                          {summary ? (
                            <Badge variant="secondary">
                              {Number(summary.total_count)} records
                            </Badge>
                          ) : (
                            <Badge variant="outline">No records</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
