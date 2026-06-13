import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor, assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
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
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, (client) =>
      buildCourseCatalogConfigPayload(
        new AcademyCourseCatalogRepository(asAcademyDatabase(client)),
        actor,
        actor.tenantId,
      ),
    );
  });
}
