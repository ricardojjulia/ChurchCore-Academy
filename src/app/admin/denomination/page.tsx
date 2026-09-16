import Link from "next/link";
import { Users, Church } from "lucide-react";
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
import { getDenominationRoster } from "@/modules/people/denomination";
import type { DenominationRosterEntry } from "@/modules/people/denomination";

export const dynamic = "force-dynamic";

// Exported so the sidebar nav (admin-shell.tsx, via admin/layout.tsx) can gate the link to this
// page with the exact same role list instead of a hand-typed copy — a drifted copy would either
// show a dead-end link to a role that can't open the page, or hide it from a role that can.
export const DENOMINATION_ROSTER_ROLES: AcademyRole[] = ["institution_admin", "registrar"];

export default async function DenominationRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ denomination?: string }>;
}) {
  const actor = await requireActor();
  requireActor(actor, DENOMINATION_ROSTER_ROLES);

  const params = await searchParams;
  const denominationFilter = params.denomination || null;

  let roster: DenominationRosterEntry[] = [];
  let capabilityDisabled = false;
  let institutionName = "your institution";

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "denominationTracking");

      // Fetch institution name for ghost page
      const profileResult = (await client.query(
        "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
        [actor.tenantId]
      )) as { rows: Array<{ institution_name?: string }> };
      const fetchedInstitutionName = profileResult.rows[0]?.institution_name;

      // getDenominationRoster already returns one aggregated row per person (person type,
      // every denomination name, active-ordination flag) in a single query — no per-row
      // enrichment queries here.
      const rosterEntries = await getDenominationRoster(actor, denominationFilter, client);

      return {
        roster: rosterEntries,
        institutionName: fetchedInstitutionName ?? "your institution",
      };
    });

    roster = result.roster;
    institutionName = result.institutionName;
  } catch (error) {
    if (error instanceof CapabilityDisabledError) {
      capabilityDisabled = true;
      // Fetch institution name even when capability is disabled, for the ghost page
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
        title="Denomination Roster"
        subtitle="Track denominational memberships, ordination records, and ministerial credentials."
      >
        <CapabilityGhostPage capability="Denomination Tracking" institutionModel={institutionName} />
      </AdminShell>
    );
  }

  const totalMembers = roster.length;
  const totalOrdained = roster.filter((r) => r.hasActiveOrdination).length;

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Denomination & Ordination"
      title="Denomination Roster"
      subtitle="Track denominational memberships, ordination records, and ministerial credentials."
    >
      <section className="ops-stats-grid">
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">People with records</div>
            <div className="ops-metric-value">{totalMembers}</div>
            <div className="ops-metric-detail">
              <Users size={13} /> Total
            </div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Active ordinations</div>
            <div className="ops-metric-value">{totalOrdained}</div>
            <div className="ops-metric-detail">
              <Church size={13} /> Current
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
              <CardTitle>Denomination Roster</CardTitle>
              <CardDescription>
                Showing {totalMembers} {totalMembers !== 1 ? "people" : "person"} with denomination or ordination records.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <form method="get" className="flex gap-2">
              <Input
                type="text"
                name="denomination"
                placeholder="Filter by denomination (leave empty for all)"
                defaultValue={denominationFilter || ""}
                className="max-w-md"
              />
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-accent hover:underline"
              >
                Filter
              </button>
              {denominationFilter && (
                <Link
                  href="/admin/denomination"
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:underline"
                >
                  Clear
                </Link>
              )}
            </form>
          </div>

          {roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No denomination or ordination records found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Person Type</TableHead>
                  <TableHead>Denomination(s)</TableHead>
                  <TableHead>Ordination Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((entry) => (
                  <TableRow key={entry.personId}>
                    <TableCell className="font-medium">{entry.displayName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.personType}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.denominationNames.length > 0
                        ? entry.denominationNames.join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {entry.hasActiveOrdination ? (
                        <Badge variant="default">Ordained</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/denomination/${entry.personId}`}
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
