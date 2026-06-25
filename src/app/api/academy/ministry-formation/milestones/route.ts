import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { recordMilestone } from "@/modules/ministry-formation/service";
import type { MilestoneType } from "@/modules/ministry-formation/types";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    return withAcademyDatabaseContext(actor, (client) =>
      recordMilestone(actor, {
        studentPersonId: String(body.studentPersonId),
        milestoneType: String(body.milestoneType) as MilestoneType,
        customTypeLabel: body.customTypeLabel ? String(body.customTypeLabel) : undefined,
        milestoneDate: String(body.milestoneDate),
        witnessNames: Array.isArray(body.witnessNames) ? body.witnessNames.map(String) : undefined,
        institutionNotes: body.institutionNotes ? String(body.institutionNotes) : undefined,
        isTransferCredit: Boolean(body.isTransferCredit),
        sourceInstitution: body.sourceInstitution ? String(body.sourceInstitution) : undefined,
      }, client),
    );
  });
}
