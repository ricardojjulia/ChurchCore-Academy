import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { AcademyGradingRecordsRepository } from "@/modules/grading-records/postgres-repository";
import type { OfficialRecordRule } from "@/modules/grading-records/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    if (!actor.roles.some((role) => ["institution_admin", "academic_admin"].includes(role))) {
      throw new AcademyAuthorizationError("Institution admin or academic admin role required.");
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "competencyNarrativeGrading");
      const repository = new AcademyGradingRecordsRepository(asAcademyDatabase(client));

      const updates: Record<string, unknown> = {};
      if (body.postingAuthority !== undefined) updates.postingAuthority = body.postingAuthority as OfficialRecordRule["postingAuthority"];
      if (body.releasePolicy !== undefined) updates.releasePolicy = body.releasePolicy as OfficialRecordRule["releasePolicy"];
      if (body.includedInTranscript !== undefined) updates.includedInTranscript = Boolean(body.includedInTranscript);
      if (body.includedInProgressReport !== undefined) updates.includedInProgressReport = Boolean(body.includedInProgressReport);
      if (body.includedInCompletionRecord !== undefined) updates.includedInCompletionRecord = Boolean(body.includedInCompletionRecord);
      if (body.includedInPromotion !== undefined) updates.includedInPromotion = Boolean(body.includedInPromotion);
      if (body.includedInGraduationAudit !== undefined) updates.includedInGraduationAudit = Boolean(body.includedInGraduationAudit);
      if (body.status !== undefined) updates.status = body.status as OfficialRecordRule["status"];

      return repository.updateOfficialRecordRule(actor, id, updates);
    });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;

    if (!actor.roles.some((role) => ["institution_admin", "academic_admin"].includes(role))) {
      throw new AcademyAuthorizationError("Institution admin or academic admin role required.");
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "competencyNarrativeGrading");
      const repository = new AcademyGradingRecordsRepository(asAcademyDatabase(client));
      await repository.deleteOfficialRecordRule(actor, id);
      return { success: true };
    });
  });
}
