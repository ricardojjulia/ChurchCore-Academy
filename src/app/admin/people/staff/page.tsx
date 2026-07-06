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

interface StaffListRow {
  personId: string;
  displayName: string;
  email: string | null;
  staffNumber: string;
  title: string;
  primaryRole: string;
  employmentStatus: string;
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusVariant(status: string) {
  if (status === "active") return "secondary";
  if (status === "inactive" || status === "archived") return "outline";
  if (status === "adjunct" || status === "volunteer") return "default";
  return "outline";
}

export default async function StaffListPage() {
  const actor = await requireActor();

  const staff = await withAcademyDatabaseContext(actor, async (client) => {
    try {
      const result = (await client.query(
        `SELECT
           p.id AS person_id,
           p.display_name,
           p.email,
           sp.staff_number,
           sp.title,
           sp.primary_role,
           sp.employment_status
         FROM academy_people p
         JOIN academy_staff_profiles sp ON sp.person_id = p.id AND sp.tenant_id = p.tenant_id
         WHERE p.tenant_id = $1
         ORDER BY p.display_name ASC`,
        [actor.tenantId]
      )) as { rows: Array<Record<string, unknown>> };

      return result.rows.map((row) => ({
        personId: String(row.person_id),
        displayName: String(row.display_name),
        email: row.email ? String(row.email) : null,
        staffNumber: String(row.staff_number),
        title: String(row.title),
        primaryRole: String(row.primary_role),
        employmentStatus: String(row.employment_status),
      })) as StaffListRow[];
    } catch (error) {
      console.warn("Staff profiles query failed, falling back to basic people list:", error);
      const fallbackResult = (await client.query(
        `SELECT id, display_name, email, person_status
         FROM academy_people
         WHERE tenant_id = $1
         ORDER BY display_name ASC
         LIMIT 50`,
        [actor.tenantId]
      )) as { rows: Array<Record<string, unknown>> };

      return fallbackResult.rows.map((row) => ({
        personId: String(row.id),
        displayName: String(row.display_name),
        email: row.email ? String(row.email) : null,
        staffNumber: "—",
        title: "—",
        primaryRole: "—",
        employmentStatus: String(row.person_status),
      })) as StaffListRow[];
    }
  });

  return (
    <AdminShell activeSection="records" eyebrow="Staff & Faculty" title="Staff List">
      <Card className="ops-panel">
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle>Faculty and Staff</CardTitle>
              <CardDescription>All staff and faculty profiles for this institution.</CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Plus size={16} strokeWidth={2} />
              New Staff Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="student-empty-state" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
              <p>No staff profiles found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Staff #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Primary Role</TableHead>
                  <TableHead>Employment Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((staffMember) => (
                  <TableRow key={staffMember.personId}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{staffMember.displayName}</div>
                      {staffMember.email && <div className="text-sm text-muted-foreground">{staffMember.email}</div>}
                    </TableCell>
                    <TableCell>
                      <code style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>{staffMember.staffNumber}</code>
                    </TableCell>
                    <TableCell>
                      <span style={{ fontSize: "0.85rem" }}>{staffMember.title}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatLabel(staffMember.primaryRole)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(staffMember.employmentStatus)}>{formatLabel(staffMember.employmentStatus)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/people/staff/${staffMember.personId}`} className="academy-action-link">
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
