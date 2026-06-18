import Link from "next/link";
import { Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeactivateStaffButton } from "@/components/deactivate-staff-button";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";

export const dynamic = "force-dynamic";

interface StaffRow {
  staff_id: string;
  person_id: string;
  display_name: string;
  email: string;
  title: string;
  primary_role: string;
  employment_status: string;
  staff_number: string;
  created_at: string;
}

export default async function StaffDirectoryPage() {
  const { actor } = await loadProtectedAcademyDataset();

  const staff = await withAcademyDatabaseContext(actor, async (client) => {
    const result = await client.query(
      `select
         sp.id            as staff_id,
         p.id             as person_id,
         p.display_name,
         p.email,
         sp.title,
         sp.primary_role,
         sp.employment_status,
         sp.staff_number,
         sp.created_at
       from academy_staff_profiles sp
       join academy_people p on p.id = sp.person_id and p.tenant_id = sp.tenant_id
       where sp.tenant_id = $1
       order by sp.employment_status, p.display_name`,
      [actor.tenantId],
    ) as { rows: StaffRow[] };
    return result.rows;
  });

  const active = staff.filter((s) => s.employment_status === "active");
  const inactive = staff.filter((s) => s.employment_status !== "active");

  return (
    <AdminShell
      activeSection="dailyops"
      eyebrow="Staff"
      title="Staff Directory"
      subtitle="All invited staff members for this institution. Use the Deactivate action to mark a staff member as inactive."
    >
      <section className="ops-stats-grid">
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Total staff</div>
            <div className="ops-metric-value">{staff.length}</div>
            <div className="ops-metric-detail"><Users size={13} /> On record</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Active</div>
            <div className="ops-metric-value">{active.length}</div>
            <div className="ops-metric-detail"><Users size={13} /> Current staff</div>
          </CardContent>
        </div>
        <div className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Inactive</div>
            <div className="ops-metric-value">{inactive.length}</div>
            <div className="ops-metric-detail"><Users size={13} /> Deactivated</div>
          </CardContent>
        </div>
      </section>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><Users /></div>
            <div>
              <CardTitle>All Staff</CardTitle>
              <CardDescription>
                Showing {staff.length} staff member{staff.length !== 1 ? "s" : ""}.{" "}
                <Link href="/admin/settings/people" className="underline">
                  Invite new staff →
                </Link>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No staff on record. <Link href="/admin/settings/people" className="underline">Invite staff</Link> to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Staff #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.staff_id}>
                    <TableCell className="font-medium">{s.display_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {s.primary_role.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{s.title}</TableCell>
                    <TableCell className="font-mono text-xs">{s.staff_number}</TableCell>
                    <TableCell>
                      <Badge variant={s.employment_status === "active" ? "secondary" : "outline"} className="capitalize">
                        {s.employment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DeactivateStaffButton
                        staffId={s.staff_id}
                        currentStatus={s.employment_status}
                      />
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
