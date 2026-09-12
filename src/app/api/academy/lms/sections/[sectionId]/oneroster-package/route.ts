import { randomUUID } from "node:crypto";
import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, type AcademyQueryClient } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertInstitutionConfigAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  buildOneRosterDatasetFromRosterSource,
  PostgresLmsRosterSourceRepository,
  type LmsRosterSourceDatabase,
} from "@/modules/lms-roster-source";
import { buildOneRosterCsvPackage } from "@/modules/oneroster-contract";

function correlationId(headers: Headers) {
  const existing = headers.get("x-correlation-id")?.trim();
  return existing || `corr-oneroster-package-${randomUUID()}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const requestCorrelationId = correlationId(request.headers);

  return handleApi(async () => {
    const { sectionId } = await params;
    if (!sectionId || sectionId.trim().length === 0) {
      throw new Error("sectionId is required.");
    }

    const { actor } = await resolveAcademyActorFromSession(request);
    assertInstitutionConfigAccess(actor, actor.tenantId, "admin");

    return withCapabilityContext(actor, async (client: AcademyQueryClient) => {
      const repository = new PostgresLmsRosterSourceRepository(
        asAcademyDatabase<LmsRosterSourceDatabase>(client),
      );
      const source = await repository.fetchSectionRosterSource(actor.tenantId, sectionId);
      const dataset = buildOneRosterDatasetFromRosterSource(source);
      const csvPackage = buildOneRosterCsvPackage(dataset, {
        generatedAt: new Date().toISOString(),
      });

      return {
        standard: "OneRoster",
        version: "1.2",
        transport: "csv-json-package",
        correlationId: requestCorrelationId,
        section: {
          id: source.id,
          sectionCode: source.sectionCode,
          courseCode: source.courseCode,
          academicPeriodId: source.academicPeriodId,
        },
        files: csvPackage.files,
      };
    });
  }, {
    operation: "oneroster.package_export",
    correlationId: requestCorrelationId,
  });
}
