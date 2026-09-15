import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import {
  recordGift,
  getAlumniGivingHistory,
  type GiftType,
} from "@/modules/people/alumni";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: alumniPersonId } = await params;

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");
      return getAlumniGivingHistory(actor, alumniPersonId, client);
    });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: alumniPersonId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const giftAmountCents = Number(body.giftAmountCents);
    const giftDate = String(body.giftDate ?? "").trim();

    if (!Number.isInteger(giftAmountCents) || giftAmountCents <= 0) {
      throw new Error("giftAmountCents must be a positive integer.");
    }
    if (!giftDate) throw new Error("giftDate is required.");

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");
      return recordGift(
        actor,
        {
          alumniPersonId,
          giftAmountCents,
          giftDate,
          giftType: body.giftType ? (body.giftType as GiftType) : undefined,
          fundDesignation: body.fundDesignation ? String(body.fundDesignation) : undefined,
          notes: body.notes ? String(body.notes) : undefined,
        },
        client,
      );
    });
  });
}
