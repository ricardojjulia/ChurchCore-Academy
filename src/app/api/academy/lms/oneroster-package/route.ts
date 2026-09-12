import { randomUUID } from "node:crypto";
import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, type AcademyQueryClient } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyCourseCatalogRepository, type CourseCatalogRepository } from "@/modules/course-catalog/postgres-repository";
import { AcademyPeopleRepository } from "@/modules/people/postgres-repository";
import {
  buildAcademyOneRosterExportPackage,
  buildOneRosterZipPackage,
  PostgresOneRosterRegistrationRepository,
  type OneRosterRegistrationDatabase,
  type OneRosterFileMode,
} from "@/modules/oneroster-contract";

type PeopleDatabase = ConstructorParameters<typeof AcademyPeopleRepository>[0];
type CourseCatalogDatabase = ConstructorParameters<typeof AcademyCourseCatalogRepository>[0];
type CourseCatalogReader = Pick<CourseCatalogRepository, "fetchCourseCatalogConfiguration">;

function correlationId(headers: Headers) {
  const existing = headers.get("x-correlation-id")?.trim();
  return existing || `corr-oneroster-export-${randomUUID()}`;
}

function packageMode(url: string): OneRosterFileMode {
  const requested = new URL(url).searchParams.get("mode")?.trim();
  if (requested && requested !== "delta") {
    throw new Error("Unsupported OneRoster export mode.");
  }
  return "delta";
}

function packageFormat(url: string) {
  const requested = new URL(url).searchParams.get("format")?.trim();
  if (!requested || requested === "json" || requested === "zip") {
    return requested || "json";
  }
  throw new Error("Unsupported OneRoster export format.");
}

export async function GET(request: Request) {
  const requestCorrelationId = correlationId(request.headers);
  const generatedAt = new Date().toISOString();

  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    assertInstitutionConfigAccess(actor, actor.tenantId, "admin");

    return withCapabilityContext(actor, async (client: AcademyQueryClient) => {
      const csvPackage = await buildAcademyOneRosterExportPackage({
        actor,
        generatedAt,
        mode: packageMode(request.url),
        peopleRepository: new AcademyPeopleRepository(asAcademyDatabase<PeopleDatabase>(client)),
        courseCatalogRepository: new AcademyCourseCatalogRepository(
          asAcademyDatabase<CourseCatalogDatabase>(client),
        ) as CourseCatalogReader,
        registrationRepository: new PostgresOneRosterRegistrationRepository(
          asAcademyDatabase<OneRosterRegistrationDatabase>(client),
        ),
      });
      const format = packageFormat(request.url);

      if (format === "zip") {
        const zip = await buildOneRosterZipPackage(csvPackage);
        const zipBody = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
        return new Response(zipBody as ArrayBuffer, {
          headers: {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="churchcore-academy-oneroster-${generatedAt.slice(0, 10)}.zip"`,
            "x-correlation-id": requestCorrelationId,
          },
        });
      }

      return {
        standard: "OneRoster",
        version: "1.2",
        profile: "churchcore-oneroster-rostering-csv-provider",
        transport: "csv-json-package",
        correlationId: requestCorrelationId,
        generatedAt,
        fileCount: csvPackage.files.length,
        rowCount: csvPackage.files.reduce((total, file) => total + Math.max(file.text.split("\n").length - 1, 0), 0),
        files: csvPackage.files,
      };
    });
  }, {
    operation: "oneroster.package_export",
    correlationId: requestCorrelationId,
  });
}
