import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import {
  createDonorCampaign,
  listDonorCampaigns,
  type DonorCampaignStatus,
} from "@/modules/people/alumni";

const DONOR_CAMPAIGN_STATUSES: DonorCampaignStatus[] = ["planned", "active", "paused", "completed"];

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    const filters: { status?: DonorCampaignStatus } = {};
    if (statusParam) {
      if (!DONOR_CAMPAIGN_STATUSES.includes(statusParam as DonorCampaignStatus)) {
        throw new Error(`Invalid status: ${statusParam}`);
      }
      filters.status = statusParam as DonorCampaignStatus;
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");
      return listDonorCampaigns(actor, filters, client);
    });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = (await request.json()) as Record<string, unknown>;

    const name = String(body.name ?? "").trim();
    const fundDesignation = String(body.fundDesignation ?? "").trim();
    const goalAmountCents = Number(body.goalAmountCents);
    const status = body.status ? String(body.status) as DonorCampaignStatus : undefined;

    if (!name) throw new Error("name is required.");
    if (!fundDesignation) throw new Error("fundDesignation is required.");
    if (!Number.isInteger(goalAmountCents) || goalAmountCents <= 0) {
      throw new Error("goalAmountCents must be a positive integer.");
    }
    if (status && !DONOR_CAMPAIGN_STATUSES.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");
      return createDonorCampaign(
        actor,
        {
          name,
          fundDesignation,
          goalAmountCents,
          startsOn: body.startsOn ? String(body.startsOn) : undefined,
          endsOn: body.endsOn ? String(body.endsOn) : undefined,
          status,
          description: body.description ? String(body.description) : undefined,
        },
        client,
      );
    });
  });
}
