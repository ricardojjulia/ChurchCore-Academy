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

interface ApplicantListRow {
  personId: string;
  displayName: string;
  email: string | null;
  studentNumber: string;
  studentType: string;
  enrollmentStatus: string;
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusVariant(status: string) {
  if (status === "application_started") return "outline";
  if (status === "pending") return "default";
  if (status === "admitted") return "secondary";
  return "outline";
}

export default async function ApplicantsListPage() {
  const actor = await requireActor();

  const applicants = await withAcademyDatabaseContext(actor, async (client) => {
    try {
      const result = (await client.query(
        `SELECT
           p.id AS person_id,
           p.display_name,
           p.email,
           sp.student_number,
           sp.student_type,
           sp.enrollment_status
         FROM academy_people p
         JOIN academy_student_profiles sp ON sp.person_id = p.id AND sp.tenant_id = p.tenant_id
         WHERE p.tenant_id = $1
           AND sp.enrollment_status IN ('application_started', 'pending', 'admitted')
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
      })) as ApplicantListRow[];
    } catch (error) {
      console.warn("Applicants query failed:", error);
      return [] as ApplicantListRow[];
    }
  });

  return (
    <AdminShell activeSection="records" eyebrow="Applicants" title="Applicant List">
      <Card className="ops-panel">
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle>Applicants</CardTitle>
              <CardDescription>Persons in pre-admission enrollment statuses.</CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Plus size={16} strokeWidth={2} />
              New Applicant
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {applicants.length === 0 ? (
            <div className="student-empty-state" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
              <p>No applicants found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Student #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Enrollment Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applicants.map((applicant) => (
                  <TableRow key={applicant.personId}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{applicant.displayName}</div>
                      {applicant.email && <div className="text-sm text-muted-foreground">{applicant.email}</div>}
                    </TableCell>
                    <TableCell>
                      <code style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>{applicant.studentNumber}</code>
                    </TableCell>
                    <TableCell>
                      <span style={{ fontSize: "0.85rem" }}>{formatLabel(applicant.studentType)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(applicant.enrollmentStatus)}>{formatLabel(applicant.enrollmentStatus)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/people/applicants/${applicant.personId}`} className="academy-action-link">
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
