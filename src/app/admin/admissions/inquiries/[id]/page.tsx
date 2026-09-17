import Link from "next/link";
import { FileText, User, Calendar } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { requireActor } from "@/lib/require-actor";
import { withCapabilityContext } from "@/lib/capability-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { getInquiry, type ApplicantCrmDatabase } from "@/modules/admissions/applicant-crm";
import { INQUIRY_PIPELINE_ROLES } from "../page";
import { InquiryStatusActions } from "./InquiryStatusActions";
import { ConvertToApplicationAction } from "./ConvertToApplicationAction";
import { TriggerDripSequenceAction } from "./TriggerDripSequenceAction";

export const dynamic = "force-dynamic";

function getStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
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

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString();
}

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  requireActor(actor, INQUIRY_PIPELINE_ROLES);

  const { id } = await params;

  let inquiry: Awaited<ReturnType<typeof getInquiry>> = null;
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

      const fetchedInquiry = await getInquiry(
        actor,
        id,
        asAcademyDatabase<ApplicantCrmDatabase>(client),
      );

      return {
        inquiry: fetchedInquiry,
        institutionName: fetchedInstitutionName ?? "your institution",
      };
    });

    inquiry = result.inquiry;
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
        title="Inquiry Detail"
        subtitle="View and manage inquiry details."
      >
        <CapabilityGhostPage capability="Admissions Workflows" institutionModel={institutionName} />
      </AdminShell>
    );
  }

  if (!inquiry) {
    return (
      <AdminShell
        activeSection="admissions"
        eyebrow="Admissions CRM"
        title="Inquiry Not Found"
        subtitle="The requested inquiry could not be found."
      >
        <Card className="ops-panel">
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Inquiry not found or you do not have permission to view it.
            </p>
            <Link
              href="/admin/admissions/inquiries"
              className="text-sm font-semibold text-accent hover:underline mt-4 inline-block"
            >
              ← Back to Inquiries
            </Link>
          </CardContent>
        </Card>
      </AdminShell>
    );
  }

  const firstName = inquiry.firstName;
  const lastName = inquiry.lastName;
  const email = inquiry.email;
  const phone = inquiry.phone ?? null;
  const programOfInterest = inquiry.programOfInterest ?? null;
  const source = inquiry.source ?? null;
  const inquiryDate = inquiry.inquiryDate;
  const status = inquiry.status;
  const assignedToPersonId = inquiry.assignedToPersonId ?? null;
  const notes = inquiry.notes ?? null;
  const convertedToApplicationId = inquiry.convertedToApplicationId ?? null;
  const createdAt = inquiry.createdAt;
  const updatedAt = inquiry.updatedAt;

  return (
    <AdminShell
      activeSection="admissions"
      eyebrow="Admissions CRM"
      title={`${firstName} ${lastName}`}
      subtitle="Inquiry details and actions."
    >
      <div className="grid gap-6">
        <Card className="ops-panel">
          <CardHeader className="ops-card-header">
            <div className="ops-heading">
              <div className="ops-icon">
                <User />
              </div>
              <div>
                <CardTitle>Contact Information</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground">First Name</label>
                <p className="text-sm">{firstName}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Last Name</label>
                <p className="text-sm">{lastName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Email</label>
                <p className="text-sm">{email}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Phone</label>
                <p className="text-sm">{phone || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader className="ops-card-header">
            <div className="ops-heading">
              <div className="ops-icon">
                <FileText />
              </div>
              <div>
                <CardTitle>Inquiry Details</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Program of Interest</label>
                <p className="text-sm">{programOfInterest || "—"}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Source</label>
                <p className="text-sm">{source ? source.replace(/_/g, " ") : "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Inquiry Date</label>
                <p className="text-sm">{formatDate(inquiryDate)}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Status</label>
                <div>
                  <Badge variant={getStatusVariant(status)}>
                    {status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Assigned To (Person ID)</label>
                <p className="text-sm">{assignedToPersonId || "—"}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Converted to Application</label>
                {convertedToApplicationId ? (
                  <Link
                    href={`/admin/admissions`}
                    className="text-sm font-semibold text-accent hover:underline"
                  >
                    View Application
                  </Link>
                ) : (
                  <p className="text-sm">—</p>
                )}
              </div>
            </div>
            {notes && (
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Notes</label>
                <p className="text-sm whitespace-pre-wrap">{notes}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <label className="font-semibold">Created</label>
                <p>{formatDateTime(createdAt)}</p>
              </div>
              <div>
                <label className="font-semibold">Updated</label>
                <p>{formatDateTime(updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="ops-panel">
          <CardHeader className="ops-card-header">
            <div className="ops-heading">
              <div className="ops-icon">
                <Calendar />
              </div>
              <div>
                <CardTitle>Actions</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <InquiryStatusActions inquiryId={id} currentStatus={status} />
            {!convertedToApplicationId && (
              <ConvertToApplicationAction inquiryId={id} inquiryEmail={email} inquiryName={`${firstName} ${lastName}`} />
            )}
            <TriggerDripSequenceAction inquiryId={id} />
          </CardContent>
        </Card>

        <div>
          <Link
            href="/admin/admissions/inquiries"
            className="text-sm font-semibold text-accent hover:underline"
          >
            ← Back to Inquiries
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}
