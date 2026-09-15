import Link from "next/link";
import { Users, DollarSign, TrendingUp, Gift } from "lucide-react";
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
import { getAlumniRoster, getGivingSummary, type AlumniRosterEntry, type AlumniStatus } from "@/modules/people/alumni";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

// dateString here is always a date-only value (e.g. "2026-08-01"), never a timestamp.
// `new Date(dateString)` parses that as UTC midnight, so `.toLocaleDateString()` in any
// timezone behind UTC (most of the US) displays the day BEFORE the one that was actually
// entered — a real, user-visible off-by-one-day bug for financial records. Parsing the
// year/month/day as local calendar components avoids the UTC round-trip entirely. Found via
// live browser testing.
function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(year, month - 1, day).toLocaleDateString();
}

function getStatusVariant(status: AlumniStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "lost_contact":
      return "secondary";
    case "deceased":
      return "outline";
    default:
      return "outline";
  }
}

export default async function AlumniRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ graduationYear?: string; status?: string }>;
}) {
  const actor = await requireActor();
  requireActor(actor, ["institution_admin", "academic_admin", "alumni_relations", "registrar"]);

  const params = await searchParams;
  const graduationYearFilter = params.graduationYear ? parseInt(params.graduationYear, 10) : undefined;
  const statusFilter = params.status as AlumniStatus | undefined;

  let roster: AlumniRosterEntry[] = [];
  let givingSummary = null;
  let capabilityDisabled = false;
  let institutionName = "your institution";

  // The giving summary requires stricter roles (no alumni_relations), consistent with the
  // module-level gate in getGivingSummary — check the actor's roles before calling a
  // function that will reject them, or alumni_relations users will see an error instead of
  // the roster without summary cards.
  const canAccessGivingSummary = actor.roles.some((role) =>
    ["institution_admin", "academic_admin", "registrar"].includes(role),
  );

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");

      // Fetch institution name for ghost page
      const profileResult = (await client.query(
        "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
        [actor.tenantId]
      )) as { rows: Array<{ institution_name?: string }> };
      const fetchedInstitutionName = profileResult.rows[0]?.institution_name;

      // getAlumniRoster already returns one aggregated row per person (with gift stats) in a
      // single query — no per-row enrichment queries here.
      const rosterEntries = await getAlumniRoster(
        actor,
        { graduationYear: graduationYearFilter, status: statusFilter },
        client
      );

      // Only call getGivingSummary if the actor has the required role
      let summary = null;
      if (canAccessGivingSummary) {
        summary = await getGivingSummary(actor, client);
      }

      return {
        roster: rosterEntries,
        givingSummary: summary,
        institutionName: fetchedInstitutionName ?? "your institution",
      };
    });

    roster = result.roster;
    givingSummary = result.givingSummary;
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
        eyebrow="Alumni & Giving"
        title="Alumni Roster"
        subtitle="Track alumni records, employment, and giving history."
      >
        <CapabilityGhostPage capability="Alumni & Giving" institutionModel={institutionName} />
      </AdminShell>
    );
  }

  const totalAlumni = roster.length;

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Alumni & Giving"
      title="Alumni Roster"
      subtitle="Track alumni records, employment, and giving history."
    >
      {givingSummary && (
        <section className="ops-stats-grid">
          <Card className="ops-metric">
            <CardContent>
              <div className="ops-metric-label">Alumni records</div>
              <div className="ops-metric-value">{totalAlumni}</div>
              <div className="ops-metric-detail">
                <Users size={13} /> Total
              </div>
            </CardContent>
          </Card>
          <Card className="ops-metric">
            <CardContent>
              <div className="ops-metric-label">Total donors</div>
              <div className="ops-metric-value">{givingSummary.totalDonors}</div>
              <div className="ops-metric-detail">
                <Users size={13} /> Active
              </div>
            </CardContent>
          </Card>
          <Card className="ops-metric">
            <CardContent>
              <div className="ops-metric-label">Total gifts</div>
              <div className="ops-metric-value">{givingSummary.totalGifts}</div>
              <div className="ops-metric-detail">
                <Gift size={13} /> All time
              </div>
            </CardContent>
          </Card>
          <Card className="ops-metric">
            <CardContent>
              <div className="ops-metric-label">Total given</div>
              <div className="ops-metric-value">{formatCurrency(givingSummary.totalAmountCents)}</div>
              <div className="ops-metric-detail">
                <DollarSign size={13} /> All time
              </div>
            </CardContent>
          </Card>
          <Card className="ops-metric">
            <CardContent>
              <div className="ops-metric-label">Average gift</div>
              <div className="ops-metric-value">{formatCurrency(givingSummary.averageGiftCents)}</div>
              <div className="ops-metric-detail">
                <TrendingUp size={13} /> Mean
              </div>
            </CardContent>
          </Card>
          <Card className="ops-metric">
            <CardContent>
              <div className="ops-metric-label">Largest gift</div>
              <div className="ops-metric-value">{formatCurrency(givingSummary.largestGiftCents)}</div>
              <div className="ops-metric-detail">
                <DollarSign size={13} /> Record
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon">
              <Users />
            </div>
            <div>
              <CardTitle>Alumni Roster</CardTitle>
              <CardDescription>
                Showing {totalAlumni} alumni {totalAlumni !== 1 ? "records" : "record"}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <form method="get" className="flex gap-2">
              <Input
                type="text"
                name="graduationYear"
                placeholder="Filter by graduation year"
                defaultValue={params.graduationYear || ""}
                className="max-w-xs"
              />
              <select
                name="status"
                defaultValue={params.status || ""}
                className="px-3 py-2 text-sm border border-border rounded-md bg-background"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="lost_contact">Lost Contact</option>
                <option value="deceased">Deceased</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-accent hover:underline"
              >
                Filter
              </button>
              {(params.graduationYear || params.status) && (
                <Link
                  href="/admin/alumni"
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:underline"
                >
                  Clear
                </Link>
              )}
            </form>
          </div>

          {roster.length === 0 ? (
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">
                No alumni records found.
              </p>
              <p className="text-sm text-muted-foreground">
                To create the first one, open a graduated student under{" "}
                <Link href="/admin/people/students" className="text-accent hover:underline">
                  People &rarr; Students
                </Link>{" "}
                and use the &ldquo;Create alumni record&rdquo; link on their profile.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Graduation Year</TableHead>
                  <TableHead>Degree</TableHead>
                  <TableHead>Employer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gifts</TableHead>
                  <TableHead>Total Given</TableHead>
                  <TableHead>Last Gift</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((entry) => (
                  <TableRow key={entry.personId}>
                    <TableCell className="font-medium">{entry.displayName}</TableCell>
                    <TableCell className="text-sm">{entry.graduationYear}</TableCell>
                    <TableCell className="text-sm">{entry.degreeEarned}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.employer || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(entry.status)}>
                        {entry.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.giftCount > 0 ? entry.giftCount : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.totalGivenCents > 0 ? formatCurrency(entry.totalGivenCents) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(entry.lastGiftDate)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/alumni/${entry.personId}`}
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
