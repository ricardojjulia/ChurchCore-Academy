import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { markGiftAcknowledged } from "@/modules/people/alumni";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ giftId: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { giftId } = await params;

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");
      return markGiftAcknowledged(actor, giftId, client);
    });
  });
}
