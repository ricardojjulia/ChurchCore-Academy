import Link from "next/link";
import { Users, Church } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { requireActor } from "@/lib/require-actor";
import { withCapabilityContext } from "@/lib/capability-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import { getDenominationRoster } from "@/modules/people/denomination";
import type { DenominationRosterEntry } from "@/modules/people/denomination";

export const dynamic = "force-dynamic";

interface RosterWithMetadata {
  personId: string;
  displayName: string;
  email: string | null;
  personType: string;
  denominationNames: string[];
  hasActiveOrdination: boolean;
}

export default async function DenominationRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ denomination?: string }>;
}) {
  const actor = await requireActor();
  requireActor(actor, ["institution_admin", "registrar"]);

  const params = await searchParams;
  const denominationFilter = params.denomination || null;

  let roster: RosterWithMetadata[] = [];
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

      // Get denomination roster
      const rosterEntries = await getDenominationRoster(actor, denominationFilter, client);

      // Enrich with person type and ordination status
      const enriched = await Promise.all(
        rosterEntries.map(async (entry: DenominationRosterEntry) => {
          // Determine person type (student or staff)
          const personTypeResult = (await client.query(
            `SELECT
               (SELECT 1 FROM academy_student_profiles WHERE person_id = $1 AND tenant_id = $2 LIMIT 1) as is_student,
               (SELECT 1 FROM academy_staff_profiles WHERE person_id = $1 AND tenant_id = $2 LIMIT 1) as is_staff`,
            [entry.personId, actor.tenantId]
          )) as { rows: Array<{ is_student: number | null; is_staff: number | null }> };

          const personType = personTypeResult.rows[0]?.is_student
            ? "Student"
            : personTypeResult.rows[0]?.is_staff
              ? "Staff"
              : "Person";

          // Get all denomination names for this person
          const denomResult = (await client.query(
            `SELECT DISTINCT denomination_name
             FROM academy_denomination_memberships
             WHERE person_id = $1 AND tenant_id = $2
             ORDER BY denomination_name`,
            [entry.personId, actor.tenantId]
          )) as { rows: Array<{ denomination_name: string }> };

          const denominationNames = denomResult.rows.map((r) => r.denomination_name);

          // Check if person has any active ordination
          const ordinationResult = (await client.query(
            `SELECT 1 FROM academy_ordination_records
             WHERE person_id = $1 AND tenant_id = $2 AND ordination_status = 'active'
             LIMIT 1`,
            [entry.personId, actor.tenantId]
          )) as { rows: Array<{ "?column?": number }> };

          const hasActiveOrdination = ordinationResult.rows.length > 0;

          return {
            personId: entry.personId,
            displayName: entry.displayName,
            email: entry.email,
            personType,
            denominationNames,
            hasActiveOrdination,
          };
        })
      );

      return {
        roster: enriched,
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
