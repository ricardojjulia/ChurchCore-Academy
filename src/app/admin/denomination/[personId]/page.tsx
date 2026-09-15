import { notFound } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { requireActor } from "@/lib/require-actor";
import { withCapabilityContext } from "@/lib/capability-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import { getDenominationMemberships, getOrdinationRecords } from "@/modules/people/denomination";
import { AddDenominationMembershipForm } from "@/components/denomination/add-membership-form";
import { UpdateDenominationMembershipForm } from "@/components/denomination/update-membership-form";
import { AddOrdinationForm } from "@/components/denomination/add-ordination-form";
import { UpdateOrdinationStatusForm } from "@/components/denomination/update-ordination-status-form";
import type { DenominationMembershipRecord, OrdinationRecord } from "@/modules/people/denomination";

export const dynamic = "force-dynamic";

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString();
}

function getMembershipStatusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "inactive":
      return "secondary";
    case "transferred":
      return "outline";
    default:
      return "outline";
  }
}

function getOrdinationStatusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "retired":
      return "secondary";
    case "suspended":
      return "outline";
    case "revoked":
      return "destructive";
    default:
      return "outline";
  }
}

function isCredentialExpired(renewalDate: string | null, status: string): boolean {
  if (!renewalDate || status !== "active") return false;
  return new Date(renewalDate) < new Date();
}

export default async function DenominationDetailPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  const actor = await requireActor();
  requireActor(actor, ["institution_admin", "registrar"]);

  let memberships: DenominationMembershipRecord[] = [];
  let ordinations: OrdinationRecord[] = [];
  let personName = "";
  let capabilityDisabled = false;
  let institutionName = "your institution";

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "denominationTracking");

      // Verify person exists in this tenant
      const personResult = (await client.query(
        `SELECT display_name FROM academy_people WHERE id = $1 AND tenant_id = $2`,
        [personId, actor.tenantId]
      )) as { rows: Array<{ display_name: string }> };

      if (personResult.rows.length === 0) {
        return null;
      }

      const [membershipRecords, ordinationRecords, profileResult] = await Promise.all([
        getDenominationMemberships(actor, personId, client),
        getOrdinationRecords(actor, personId, client),
        client.query(
          "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
          [actor.tenantId]
        ) as Promise<{ rows: Array<{ institution_name?: string }> }>,
      ]);

      return {
        personName: personResult.rows[0].display_name,
        memberships: membershipRecords,
        ordinations: ordinationRecords,
        institutionName: profileResult.rows[0]?.institution_name ?? "your institution",
      };
    });

    if (!result) {
      notFound();
    }

    personName = result.personName;
    memberships = result.memberships;
    ordinations = result.ordinations;
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
        activeSection="records"
        eyebrow="Denomination & Ordination"
        title="Person Records"
      >
        <CapabilityGhostPage capability="Denomination Tracking" institutionModel={institutionName} />
      </AdminShell>
    );
  }

  const canModify = actor.roles.some((role) => ["institution_admin", "registrar"].includes(role));

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Denomination & Ordination"
      title={personName}
    >
      <div className="mb-4">
        <Link
          href="/admin/denomination"
          className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
        >
          <ArrowLeft size={16} /> All Records
        </Link>
      </div>

      {/* Denomination Memberships Section */}
      <Card className="ops-panel mb-6">
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <CardTitle>Denomination Memberships</CardTitle>
            {canModify && <AddDenominationMembershipForm personId={personId} />}
          </div>
        </CardHeader>
        <CardContent>
          {memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No denomination memberships recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Denomination</TableHead>
                  <TableHead>Local Church</TableHead>
                  <TableHead>Membership #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Membership Date</TableHead>
                  <TableHead>Transfer Date</TableHead>
                  <TableHead>Notes</TableHead>
                  {canModify && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell className="font-medium">{membership.denominationName}</TableCell>
                    <TableCell className="text-sm">
                      {membership.localChurchName || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {membership.membershipNumber ? (
                        <code style={{ fontSize: "0.85rem" }}>{membership.membershipNumber}</code>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getMembershipStatusVariant(membership.membershipStatus)}>
                        {membership.membershipStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(membership.membershipDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(membership.transferDate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {membership.notes ? (
                        <span className="max-w-xs truncate inline-block">{membership.notes}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {canModify && (
                      <TableCell>
                        <UpdateDenominationMembershipForm
                          personId={personId}
                          membership={membership}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ordination Records Section */}
      <Card className="ops-panel">
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <CardTitle>Ordination Records</CardTitle>
            {canModify && <AddOrdinationForm personId={personId} />}
          </div>
        </CardHeader>
        <CardContent>
          {ordinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ordination records found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Ordaining Body</TableHead>
                  <TableHead>Ordination Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Credentials #</TableHead>
                  <TableHead>Renewal Date</TableHead>
                  <TableHead>Notes</TableHead>
                  {canModify && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordinations.map((ordination) => {
                  const expired = isCredentialExpired(ordination.renewalDate, ordination.ordinationStatus);
                  return (
                    <TableRow key={ordination.id}>
                      <TableCell className="font-medium">
                        {ordination.ordinationType}
                      </TableCell>
                      <TableCell className="text-sm">{ordination.ordainingBody}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(ordination.ordinationDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={getOrdinationStatusVariant(ordination.ordinationStatus)}>
                            {ordination.ordinationStatus}
                          </Badge>
                          {expired && (
                            <span className="text-destructive flex items-center gap-1" title="Renewal date has passed">
                              <AlertCircle size={14} />
                              <span className="text-xs">Expired</span>
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ordination.credentialsNumber ? (
                          <code style={{ fontSize: "0.85rem" }}>{ordination.credentialsNumber}</code>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(ordination.renewalDate)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {ordination.notes ? (
                          <span className="max-w-xs truncate inline-block">{ordination.notes}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      {canModify && (
                        <TableCell>
                          <UpdateOrdinationStatusForm
                            personId={personId}
                            ordination={ordination}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
