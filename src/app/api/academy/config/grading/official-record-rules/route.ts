import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { AcademyGradingRecordsRepository } from "@/modules/grading-records/postgres-repository";
import type { OfficialRecordRule } from "@/modules/grading-records/types";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = (await request.json()) as Record<string, unknown>;

    if (!actor.roles.some((role) => ["institution_admin", "academic_admin"].includes(role))) {
      throw new AcademyAuthorizationError("Institution admin or academic admin role required.");
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "competencyNarrativeGrading");
      const repository = new AcademyGradingRecordsRepository(asAcademyDatabase(client));
      return repository.createOfficialRecordRule(actor, {
        recordType: body.recordType as OfficialRecordRule["recordType"],
        appliesToInstitutionMode: body.appliesToInstitutionMode as OfficialRecordRule["appliesToInstitutionMode"],
        postingAuthority: body.postingAuthority as OfficialRecordRule["postingAuthority"],
        releasePolicy: body.releasePolicy as OfficialRecordRule["releasePolicy"],
        includedInTranscript: Boolean(body.includedInTranscript),
        includedInProgressReport: Boolean(body.includedInProgressReport),
        includedInCompletionRecord: Boolean(body.includedInCompletionRecord),
        includedInPromotion: Boolean(body.includedInPromotion),
        includedInGraduationAudit: Boolean(body.includedInGraduationAudit),
        status: body.status as OfficialRecordRule["status"],
      });
    });
  });
}
