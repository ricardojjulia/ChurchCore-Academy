import Link from "next/link";
import { ArrowLeft, Gift, Target, TrendingUp, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { DonorCampaignForm } from "@/components/admin/donor-campaign-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CapabilityGhostPage } from "@/components/ui/CapabilityGhostPage";
import { requireActor } from "@/lib/require-actor";
import { withCapabilityContext } from "@/lib/capability-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { assertCapability, CapabilityDisabledError } from "@/modules/academy-auth/policy";
import { listDonorCampaigns, type DonorCampaignStatus, type DonorCampaignWithGiving } from "@/modules/people/alumni";
import { ALUMNI_ROSTER_ROLES } from "../page";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return "-";
  return new Date(year, month - 1, day).toLocaleDateString();
}

function statusVariant(status: DonorCampaignStatus): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "paused") return "secondary";
  return "outline";
}

export default async function DonorCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const actor = await requireActor();
  requireActor(actor, ALUMNI_ROSTER_ROLES);

  const params = await searchParams;
  const statusFilter = params.status as DonorCampaignStatus | undefined;

  let campaigns: DonorCampaignWithGiving[] = [];
  let capabilityDisabled = false;
  let institutionName = "your institution";

  try {
    const result = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");

      const profileResult = (await client.query(
        "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
        [actor.tenantId],
      )) as { rows: Array<{ institution_name?: string }> };

      return {
        campaigns: await listDonorCampaigns(actor, { status: statusFilter }, client),
        institutionName: profileResult.rows[0]?.institution_name ?? "your institution",
      };
    });

    campaigns = result.campaigns;
    institutionName = result.institutionName;
  } catch (error) {
    if (error instanceof CapabilityDisabledError) {
      capabilityDisabled = true;
      try {
        institutionName = await withAcademyDatabaseContext(actor, async (client) => {
          const profileResult = (await client.query(
            "SELECT institution_name FROM academy_institution_profiles WHERE tenant_id = $1",
            [actor.tenantId],
          )) as { rows: Array<{ institution_name?: string }> };
          return profileResult.rows[0]?.institution_name ?? "your institution";
        });
      } catch {
        institutionName = "your institution";
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
        title="Donor Campaigns"
        subtitle="Plan giving campaigns and monitor donor progress."
      >
        <CapabilityGhostPage capability="Alumni & Giving" institutionModel={institutionName} />
      </AdminShell>
    );
  }

  const totalGoal = campaigns.reduce((sum, campaign) => sum + campaign.goalAmountCents, 0);
  const totalGiven = campaigns.reduce((sum, campaign) => sum + campaign.totalGivenCents, 0);
  const totalDonors = campaigns.reduce((sum, campaign) => sum + campaign.donorCount, 0);

  return (
    <AdminShell
      activeSection="records"
      eyebrow="Alumni & Giving"
      title="Donor Campaigns"
      subtitle="Create fundraising campaigns and track campaign-level giving."
    >
      <div className="mb-4">
        <Link href="/admin/alumni" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
          <ArrowLeft size={16} />
          Alumni roster
        </Link>
      </div>

      <section className="ops-stats-grid">
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Campaigns</div>
            <div className="ops-metric-value">{campaigns.length}</div>
            <div className="ops-metric-detail"><Target size={13} /> Total</div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Goal</div>
            <div className="ops-metric-value">{formatCurrency(totalGoal)}</div>
            <div className="ops-metric-detail"><TrendingUp size={13} /> Combined</div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Given</div>
            <div className="ops-metric-value">{formatCurrency(totalGiven)}</div>
            <div className="ops-metric-detail"><Gift size={13} /> Matched</div>
          </CardContent>
        </Card>
        <Card className="ops-metric">
          <CardContent>
            <div className="ops-metric-label">Donors</div>
            <div className="ops-metric-value">{totalDonors}</div>
            <div className="ops-metric-detail"><Users size={13} /> Across campaigns</div>
          </CardContent>
        </Card>
      </section>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><Target /></div>
            <div>
              <CardTitle>Create Campaign</CardTitle>
              <CardDescription>
                Campaign gifts can be linked directly or matched from existing fund designations.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DonorCampaignForm />
        </CardContent>
      </Card>

      <Card className="ops-panel">
        <CardHeader className="ops-card-header">
          <div className="ops-heading">
            <div className="ops-icon"><Gift /></div>
            <div>
              <CardTitle>Campaign Progress</CardTitle>
              <CardDescription>
                Showing {campaigns.length} donor {campaigns.length === 1 ? "campaign" : "campaigns"}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form method="get" className="mb-4 flex gap-2">
            <select
              name="status"
              defaultValue={params.status || ""}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
            <button type="submit" className="px-4 py-2 text-sm font-semibold text-accent hover:underline">
              Filter
            </button>
            {params.status && (
              <Link href="/admin/alumni/campaigns" className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:underline">
                Clear
              </Link>
            )}
          </form>

          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No donor campaigns found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead>Given</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Gifts</TableHead>
                  <TableHead>Donors</TableHead>
                  <TableHead>Last Gift</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{campaign.fundDesignation}</TableCell>
                    <TableCell className="text-sm">{formatCurrency(campaign.goalAmountCents)}</TableCell>
                    <TableCell className="text-sm">{formatCurrency(campaign.totalGivenCents)}</TableCell>
                    <TableCell className="text-sm">{campaign.progressPercent}%</TableCell>
                    <TableCell className="text-sm">{campaign.giftCount}</TableCell>
                    <TableCell className="text-sm">{campaign.donorCount}</TableCell>
                    <TableCell className="text-sm">{formatDate(campaign.lastGiftDate)}</TableCell>
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
