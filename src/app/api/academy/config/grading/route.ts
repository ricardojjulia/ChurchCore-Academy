import { handleApi } from "@/app/api/academy/api-utils";
import { AcademyActor, assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyGradingRecordsRepository } from "@/modules/grading-records/postgres-repository";
import { GradingRecordsConfiguration } from "@/modules/grading-records/types";
import { validateGradingRecordsConfiguration } from "@/modules/grading-records/validation";

interface GradingRecordsConfigReader {
  fetchGradingRecordsConfiguration(tenantId: string): Promise<GradingRecordsConfiguration>;
}

export async function buildGradingRecordsConfigPayload(
  repository: GradingRecordsConfigReader,
  actor: AcademyActor,
  tenantId: string,
) {
  assertInstitutionConfigAccess(actor, tenantId, "read");

  const gradingRecords = await repository.fetchGradingRecordsConfiguration(tenantId);

  return {
    gradingRecords,
    validation: validateGradingRecordsConfiguration(gradingRecords),
  };
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return buildGradingRecordsConfigPayload(new AcademyGradingRecordsRepository(), actor, actor.tenantId);
  });
}
