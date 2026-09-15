import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { recordMilestone } from "@/modules/ministry-formation/service";
import type { MilestoneType } from "@/modules/ministry-formation/types";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    return withCapabilityContext(actor, (client, capabilities) => {
      assertCapability(capabilities, "ministryFormation");
      return recordMilestone(actor, {
        studentPersonId: String(body.studentPersonId),
        milestoneType: String(body.milestoneType) as MilestoneType,
        customTypeLabel: body.customTypeLabel ? String(body.customTypeLabel) : undefined,
        milestoneDate: String(body.milestoneDate),
        witnessNames: Array.isArray(body.witnessNames) ? body.witnessNames.map(String) : undefined,
        institutionNotes: body.institutionNotes ? String(body.institutionNotes) : undefined,
        isTransferCredit: Boolean(body.isTransferCredit),
        sourceInstitution: body.sourceInstitution ? String(body.sourceInstitution) : undefined,
      }, client);
    });
  });
}
