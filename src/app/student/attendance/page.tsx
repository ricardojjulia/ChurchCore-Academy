import { ClipboardCheck } from "lucide-react";
import { StudentPwaShell } from "@/components/student-pwa-shell";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

export const dynamic = "force-dynamic";

interface AttendanceRow {
  section_code: string;
  session_date: string;
  status: string;
  note: string | null;
}

function statusVariant(status: string) {
  if (status === "present") return "secondary";
  if (status === "absent") return "destructive";
  return "outline";
}

export default async function StudentAttendancePage() {
  const { actor, dataset } = await loadProtectedAcademyDataset();

  const sectionById = new Map(
    dataset.sections.map((s) => [s.id, s]),
  );

  const records = await withAcademyDatabaseContext(actor, async (client) => {
    const result = await client.query(
      `select
         ar.course_section_id::text as section_id,
         ar.session_date::text      as session_date,
         ar.status,
         ar.note
       from academy_attendance_records ar
       where ar.tenant_id = $1
         and ar.student_person_id::text = $2
       order by ar.session_date desc, ar.course_section_id`,
      [actor.tenantId, actor.userId],
    ) as { rows: (Omit<AttendanceRow, "section_code"> & { section_id: string })[] };
    return result.rows.map((r) => ({
      ...r,
      section_code: sectionById.get(r.section_id)?.code ?? r.section_id.slice(0, 8),
      section_title: sectionById.get(r.section_id)?.title ?? "—",
    }));
  });

  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const lateCount = records.filter((r) => r.status === "late").length;

  return (
    <StudentPwaShell
      activeHref="/student/attendance"
      title="My Attendance"
      description="Your attendance records by section and session date as submitted by faculty."
    >
      <div className="student-pwa-stats">
        <div className="student-pwa-stat">
          <span className="student-pwa-stat-value">{records.length}</span>
          <span className="student-pwa-stat-label">Total sessions</span>
        </div>
        <div className="student-pwa-stat">
          <span className="student-pwa-stat-value">{presentCount}</span>
          <span className="student-pwa-stat-label">Present</span>
        </div>
        <div className="student-pwa-stat">
          <span className="student-pwa-stat-value">{absentCount}</span>
          <span className="student-pwa-stat-label">Absent</span>
        </div>
        <div className="student-pwa-stat">
          <span className="student-pwa-stat-value">{lateCount}</span>
          <span className="student-pwa-stat-label">Late</span>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="student-pwa-empty">
          <ClipboardCheck size={24} strokeWidth={1.5} />
          <p>No attendance records found. Records appear here once faculty submit attendance for your sections.</p>
        </div>
      ) : (
        <div className="student-pwa-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section</TableHead>
                <TableHead>Session Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.section_code}</TableCell>
                  <TableCell className="text-sm">{r.session_date}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)} className="capitalize">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </StudentPwaShell>
  );
}
