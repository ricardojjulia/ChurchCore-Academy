import { handleApi } from "@/app/api/academy/api-utils";
import { AcademyActor, assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import { InstitutionProfile } from "@/modules/academy-config/types";
import { validateInstitutionProfile } from "@/modules/academy-config/validation";

interface InstitutionConfigReader {
  fetchInstitutionProfile(tenantId: string): Promise<InstitutionProfile>;
}

export async function buildInstitutionConfigPayload(repository: InstitutionConfigReader, actor: AcademyActor, tenantId: string) {
  assertInstitutionConfigAccess(actor, tenantId, "read");

  const institutionProfile = await repository.fetchInstitutionProfile(tenantId);

  return {
    institutionProfile,
    validation: validateInstitutionProfile(institutionProfile),
  };
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return buildInstitutionConfigPayload(new AcademyConfigRepository(), actor, actor.tenantId);
  });
}
