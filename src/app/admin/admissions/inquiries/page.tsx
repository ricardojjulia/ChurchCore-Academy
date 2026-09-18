import Link from "next/link";
import { Mail, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { requireActor } from "@/lib/require-actor";
import type { AcademyRole } from "@/modules/academy-auth/policy";
import { withCapabilityContext } from "@/lib/capability-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import {
  listInquiries,
  type Inquiry,
  type InquiryStatus,
  type ApplicantCrmDatabase,
} from "@/modules/admissions/applicant-crm";

export const dynamic = "force-dynamic";

function getStatusVariant(status: InquiryStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "new":
      return "default";
    case "contacted":
    case "nurturing":
      return "secondary";
    case "applied":
    case "enrolled":
      return "default";
    case "lost":
      return "destructive";
    default:
      return "outline";
  }
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return dateString;
  return new Date(year, month - 1, day).toLocaleDateString();
}

// Exported for nav gating in admin-shell.tsx
export const INQUIRY_PIPELINE_ROLES: AcademyRole[] = [
  "institution_admin",
  "admissions",
];

export default async function InquiriesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignedToPersonId?: string }>;
}) {
  const actor = await requireActor();
  requireActor(actor, INQUIRY_PIPELINE_ROLES);

  const params = await searchParams;
  const statusFilter = params.status as InquiryStatus | undefined;
  const assignedToPersonIdFilter = params.assignedToPersonId;

  let inquiries: Inquiry[] = [];
  let capabilityDisabled = false;
  let institutionName = "your institution";

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");

      // Fetch institution name for ghost page
      const profileResult = (await client.query(
        "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
        [actor.tenantId]
      )) as { rows: Array<{ institution_name?: string }> };
      const fetchedInstitutionName = profileResult.rows[0]?.institution_name;

      const inquiriesList = await listInquiries(
        actor,
        {
          status: statusFilter,
          assignedToPersonId: assignedToPersonIdFilter,
        },
        asAcademyDatabase<ApplicantCrmDatabase>(client)
      );

      return {
        inquiries: inquiriesList,
        institutionName: fetchedInstitutionName ?? "your institution",
      };
    });

    inquiries = result.inquiries;
    institutionName = result.institutionName;
  } catch (error) {
    if (error instanceof CapabilityDisabledError) {
      capabilityDisabled = true;
      try {
        institutionName = await withAcademyDatabaseContext(actor, async (client) => {
          const profileResult = (await client.query(
            "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
            [actor.tenantId]
          )) as { rows: Array<{ institution_name?: string }> };
          return profileResult.rows[0]?.institution_name ?? "your institution";
        });
      } catch {
        // Fallback to default if fetch fails
      }
    } else {
      throw error;
    }
  }

  if (capabilityDisabled) {
    return (
      <AdminShell
        activeSection="admissions"
        eyebrow="Admissions CRM"
        title="Inquiry Pipeline"
        subtitle="Track and manage prospective student inquiries through the admissions funnel."
      >
        <CapabilityGhostPage capability="Admissions Workflows" institutionModel={institutionName} />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      activeSection="admissions"
      eyebrow="Admissions CRM"
      title="Inquiry Pipeline"
      subtitle="Track and manage prospective student inquiries through the admissions funnel."
    >
      <section className="ops-stats-grid">
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Total inquiries</div>
            <div className="ops-metric-value">{inquiries.length}</div>
            <div className="ops-metric-detail">
              <Users size={13} /> All time
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">New</div>
            <div className="ops-metric-value">
              {inquiries.filter((i) => i.status === "new").length}
            </div>
            <div className="ops-metric-detail">
              <Mail size={13} /> Uncontacted
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Nurturing</div>
            <div className="ops-metric-value">
              {inquiries.filter((i) => i.status === "nurturing" || i.status === "contacted").length}
            </div>
            <div className="ops-metric-detail">
              <Users size={13} /> Active
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Applied</div>
            <div className="ops-metric-value">
              {inquiries.filter((i) => i.status === "applied").length}
            </div>
            <div className="ops-metric-detail">
              <Mail size={13} /> Converted
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
              <CardTitle>Inquiries</CardTitle>
              <CardDescription>
                Showing {inquiries.length} inquir{inquiries.length !== 1 ? "ies" : "y"}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <form method="get" className="flex gap-2">
              <select
                name="status"
                defaultValue={params.status || ""}
                className="px-3 py-2 text-sm border border-border rounded-md bg-background"
              >
                <option value="">All statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="nurturing">Nurturing</option>
                <option value="applied">Applied</option>
                <option value="enrolled">Enrolled</option>
                <option value="lost">Lost</option>
              </select>
              <Input
                type="text"
                name="assignedToPersonId"
                placeholder="Filter by assigned person ID"
                defaultValue={params.assignedToPersonId || ""}
                className="max-w-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-accent hover:underline"
              >
                Filter
              </button>
              {(params.status || params.assignedToPersonId) && (
                <Link
                  href="/admin/admissions/inquiries"
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:underline"
                >
                  Clear
                </Link>
              )}
            </form>
          </div>

          {inquiries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No inquiries found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Inquiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries.map((inquiry) => (
                  <TableRow key={inquiry.id}>
                    <TableCell className="font-medium">
                      {inquiry.firstName} {inquiry.lastName}
                    </TableCell>
                    <TableCell className="text-sm">{inquiry.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inquiry.phone || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inquiry.programOfInterest || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {inquiry.source ? inquiry.source.replace(/_/g, " ") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(inquiry.inquiryDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(inquiry.status)}>
                        {inquiry.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/admissions/inquiries/${inquiry.id}`}
                        className="text-sm font-semibold text-accent hover:underline"
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
