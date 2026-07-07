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

interface GuardianListRow {
  personId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  personStatus: string;
  activeStudentCount: number;
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusVariant(status: string) {
  if (status === "active") return "secondary";
  if (status === "inactive" || status === "archived") return "outline";
  if (status === "invited") return "default";
  return "outline";
}

export default async function GuardiansListPage() {
  const actor = await requireActor();

  const guardians = await withAcademyDatabaseContext(actor, async (client) => {
    try {
      const result = (await client.query(
        `SELECT
           p.id AS person_id,
           p.display_name,
           p.email,
           p.phone,
           p.person_status,
           COUNT(DISTINCT r.student_person_id) as active_student_count
         FROM academy_people p
         JOIN academy_person_role_assignments pra ON pra.person_id = p.id AND pra.tenant_id = p.tenant_id AND pra.role = 'guardian'
         LEFT JOIN academy_student_relationships r ON r.related_person_id = p.id AND r.tenant_id = p.tenant_id AND r.status = 'active'
         WHERE p.tenant_id = $1
         GROUP BY p.id, p.display_name, p.email, p.phone, p.person_status
         ORDER BY p.display_name ASC`,
        [actor.tenantId]
      )) as { rows: Array<Record<string, unknown>> };

      return result.rows.map((row) => ({
        personId: String(row.person_id),
        displayName: String(row.display_name),
        email: row.email ? String(row.email) : null,
        phone: row.phone ? String(row.phone) : null,
        personStatus: String(row.person_status),
        activeStudentCount: Number(row.active_student_count),
      })) as GuardianListRow[];
    } catch (error) {
      console.warn("Guardians query failed, falling back to basic people list:", error);
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
        phone: null,
        personStatus: String(row.person_status),
        activeStudentCount: 0,
      })) as GuardianListRow[];
    }
  });

  return (
    <AdminShell activeSection="records" eyebrow="Guardians" title="Guardian List">
      <Card className="ops-panel">
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <CardTitle>Guardians</CardTitle>
              <CardDescription>All persons with active guardian role assignments.</CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Plus size={16} strokeWidth={2} />
              New Guardian
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {guardians.length === 0 ? (
            <div className="student-empty-state" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
              <p>No guardian profiles found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Person Status</TableHead>
                  <TableHead>Active Students</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guardians.map((guardian) => (
                  <TableRow key={guardian.personId}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{guardian.displayName}</div>
                      {guardian.email && <div className="text-sm text-muted-foreground">{guardian.email}</div>}
                    </TableCell>
                    <TableCell>
                      <span style={{ fontSize: "0.85rem" }}>{guardian.phone || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(guardian.personStatus)}>{formatLabel(guardian.personStatus)}</Badge>
                    </TableCell>
                    <TableCell>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{guardian.activeStudentCount}</span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/people/guardians/${guardian.personId}`} className="academy-action-link">
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
