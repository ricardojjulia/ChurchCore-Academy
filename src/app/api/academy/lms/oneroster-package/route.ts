import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertInstitutionConfigAccess, assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyCourseCatalogRepository } from "@/modules/course-catalog/postgres-repository";
import { AcademyPeopleRepository } from "@/modules/people/postgres-repository";
import { buildAcademyOneRosterExportPackage, buildOneRosterZipPackage, PostgresOneRosterRegistrationRepository } from "@/modules/oneroster-contract";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { actor } = await resolveAcademyActorFromSession(request);
    assertInstitutionConfigAccess(actor, actor.tenantId, "admin");
    const params = new URL(request.url).searchParams;
    const sectionId = params.get("sectionId");
    if (!sectionId?.trim()) throw new Error("Invalid sectionId.");
    if (params.has("mode") && params.get("mode") !== "delta") throw new Error("Invalid export mode.");
    const csvPackage = await withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "lmsRosterSync");
      return buildAcademyOneRosterExportPackage({
      actor,
      sectionId,
      peopleRepository: new AcademyPeopleRepository(asAcademyDatabase<ConstructorParameters<typeof AcademyPeopleRepository>[0]>(client)),
      courseCatalogRepository: new AcademyCourseCatalogRepository(asAcademyDatabase<ConstructorParameters<typeof AcademyCourseCatalogRepository>[0]>(client)),
      registrationRepository: new PostgresOneRosterRegistrationRepository(asAcademyDatabase<ConstructorParameters<typeof PostgresOneRosterRegistrationRepository>[0]>(client)),
      });
    });
    const zip = await buildOneRosterZipPackage(csvPackage);
    return new Response(new Uint8Array(zip), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="academy-roster.zip"',
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const response = await handleApi(async () => { throw error; }, { operation: "oneroster.package_export" });
    response.headers.set("cache-control", "private, no-store");
    return response;
  }
}
