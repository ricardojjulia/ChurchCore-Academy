import Link from "next/link";
import { Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActor } from "@/lib/require-actor";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

export const dynamic = "force-dynamic";

interface AdvisorRow {
  person_id: string;
  display_name: string;
  email: string | null;
  person_status: string;
  roles: string[];
  student_count: number;
}

export default async function AdvisorsListPage() {
  const actor = await requireActor();

  const advisors = await withAcademyDatabaseContext(actor, async (client) => {
    let result;
    try {
      result = await client.query(
        `select p.id as person_id,
           p.display_name,
           p.email,
           p.person_status,
           array_agg(distinct pra.role) as roles,
           count(distinct sp.id) as student_count
         from academy_people p
         join academy_person_role_assignments pra on pra.person_id = p.id and pra.tenant_id = p.tenant_id
         left join academy_student_profiles sp on sp.advisor_person_id = p.id and sp.tenant_id = p.tenant_id
         where p.tenant_id = $1
           and pra.role = 'advisor'
           and pra.status = 'active'
         group by p.id, p.display_name, p.email, p.person_status
         order by p.display_name`,
        [actor.tenantId],
      ) as { rows: AdvisorRow[] };
    } catch {
      result = await client.query(
        `select id as person_id,
           display_name,
           email,
           person_status,
           array[]::text[] as roles,
           0 as student_count
         from academy_people
         where tenant_id = $1 and person_status = 'active'
         limit 50`,
        [actor.tenantId],
      ) as { rows: AdvisorRow[] };
    }
    return result.rows;
  });

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Advisors"
      title="Academic Advisors"
      subtitle="All persons with advisor-capable roles."
    >
      <section className="ops-stats-grid">
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Total advisors</div>
            <div className="ops-metric-value">{advisors.length}</div>
            <div className="ops-metric-detail">
              <Users size={13} /> On record
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Active</div>
            <div className="ops-metric-value">
              {advisors.filter((a) => a.person_status === "active").length}
            </div>
            <div className="ops-metric-detail">
              <Users size={13} /> Currently active
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Students assigned</div>
            <div className="ops-metric-value">
              {advisors.reduce((sum, a) => sum + a.student_count, 0)}
            </div>
            <div className="ops-metric-detail">
              <Users size={13} /> Total advisees
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon">
              <Users />
            </div>
            <div>
              <CardTitle>All Advisors</CardTitle>
              <CardDescription>
                Showing {advisors.length} advisor{advisors.length !== 1 ? "s" : ""}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {advisors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No advisors on record.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Assigned Students</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advisors.map((a) => (
                  <TableRow key={a.person_id}>
                    <TableCell>
                      <div className="font-medium">{a.display_name}</div>
                      {a.email && (
                        <div className="text-sm text-muted-foreground">{a.email}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {a.roles.map((role, i) => (
                          <Badge key={i} variant="outline" className="capitalize">
                            {role.replaceAll("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{a.student_count}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/people/advisors/${a.person_id}`}
                        className="text-sm font-semibold text-blue-600 hover:underline"
                      >
                        View
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
