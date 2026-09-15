import { handleApi, requireStringField, requireBooleanField } from "@/app/api/academy/api-utils";
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
        recordType: requireStringField(body.recordType, "recordType") as OfficialRecordRule["recordType"],
        appliesToInstitutionMode: requireStringField(body.appliesToInstitutionMode, "appliesToInstitutionMode") as OfficialRecordRule["appliesToInstitutionMode"],
        postingAuthority: requireStringField(body.postingAuthority, "postingAuthority") as OfficialRecordRule["postingAuthority"],
        releasePolicy: requireStringField(body.releasePolicy, "releasePolicy") as OfficialRecordRule["releasePolicy"],
        includedInTranscript: requireBooleanField(body.includedInTranscript, "includedInTranscript"),
        includedInProgressReport: requireBooleanField(body.includedInProgressReport, "includedInProgressReport"),
        includedInCompletionRecord: requireBooleanField(body.includedInCompletionRecord, "includedInCompletionRecord"),
        includedInPromotion: requireBooleanField(body.includedInPromotion, "includedInPromotion"),
        includedInGraduationAudit: requireBooleanField(body.includedInGraduationAudit, "includedInGraduationAudit"),
        status: requireStringField(body.status, "status") as OfficialRecordRule["status"],
      });
    });
  });
}
