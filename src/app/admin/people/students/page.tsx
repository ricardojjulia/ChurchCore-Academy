import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

export const dynamic = "force-dynamic";

interface StudentListRow {
  personId: string;
  displayName: string;
  email: string | null;
  studentNumber: string;
  studentType: string;
  enrollmentStatus: string;
  personStatus: string;
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusVariant(status: string) {
  if (status === "active") return "secondary";
  if (status === "inactive" || status === "archived") return "outline";
  if (status === "withdrawn") return "destructive";
  return "default";
}

export default async function StudentListPage() {
  const actor = await requireActor();

  const students = await withAcademyDatabaseContext(actor, async (client) => {
    const result = (await client.query(
      `SELECT
         p.id AS person_id,
         p.display_name,
         p.email,
         p.person_status,
         sp.student_number,
         sp.student_type,
         sp.enrollment_status
       FROM academy_people p
       JOIN academy_student_profiles sp ON sp.person_id = p.id AND sp.tenant_id = p.tenant_id
       WHERE p.tenant_id = $1
       ORDER BY p.display_name ASC`,
      [actor.tenantId]
    )) as { rows: Array<Record<string, unknown>> };

    return result.rows.map((row) => ({
      personId: String(row.person_id),
      displayName: String(row.display_name),
      email: row.email ? String(row.email) : null,
      studentNumber: String(row.student_number),
      studentType: String(row.student_type),
      enrollmentStatus: String(row.enrollment_status),
      personStatus: String(row.person_status),
    })) as StudentListRow[];
  });

  return (
    <AdminShell activeSection="records" eyebrow="Students" title="Student List">
      <Card className="ops-panel">
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>All student profiles for this institution.</CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Plus size={16} strokeWidth={2} />
              New Student
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="student-empty-state" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
              <p>No students found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Student #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Person Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.personId}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{student.displayName}</div>
                      {student.email && <div className="text-sm text-muted-foreground">{student.email}</div>}
                    </TableCell>
                    <TableCell>
                      <code style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>{student.studentNumber}</code>
                    </TableCell>
                    <TableCell>
                      <span style={{ fontSize: "0.85rem" }}>{formatLabel(student.studentType)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(student.enrollmentStatus)}>{formatLabel(student.enrollmentStatus)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(student.personStatus)}>{formatLabel(student.personStatus)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/people/students/${student.personId}`} className="academy-action-link">
                        Open
                        <ArrowRight size={14} strokeWidth={2} />
                      </Link>
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
