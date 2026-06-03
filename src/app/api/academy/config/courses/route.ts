import { handleApi } from "@/app/api/academy/api-utils";
import { AcademyActor, assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { resolveBootstrapAcademyActor } from "@/modules/academy-auth/request-context";
import { AcademyCourseCatalogRepository } from "@/modules/course-catalog/postgres-repository";
import { CourseCatalogConfiguration } from "@/modules/course-catalog/types";
import { validateCourseCatalogConfiguration } from "@/modules/course-catalog/validation";

interface CourseCatalogConfigReader {
  fetchCourseCatalogConfiguration(tenantId: string): Promise<CourseCatalogConfiguration>;
}

export async function buildCourseCatalogConfigPayload(
  repository: CourseCatalogConfigReader,
  actor: AcademyActor,
  tenantId: string,
) {
  assertInstitutionConfigAccess(actor, tenantId, "read");

  const courseCatalog = await repository.fetchCourseCatalogConfiguration(tenantId);

  return {
    courseCatalog,
    validation: validateCourseCatalogConfiguration(courseCatalog),
  };
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const actor = resolveBootstrapAcademyActor(request.headers);
    return buildCourseCatalogConfigPayload(new AcademyCourseCatalogRepository(), actor, actor.tenantId);
  });
}
