import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import {
  AcademyAuthenticationError,
  AcademyAuthorizationError,
} from "@/modules/academy-auth/errors";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresReportRepository,
  type ReportingDatabase,
} from "@/modules/reporting/postgres-repository";
import {
  assertReportingAccess,
  generateIpedsExportFromDataset,
  ReportingService,
} from "@/modules/reporting/service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  if (format === "csv") {
    try {
      const { actor } = await resolveAcademyActorFromSession(request);
      assertReportingAccess(actor);
      const csv = await withAcademyDatabaseContext(actor, async (client) => {
        const service = new ReportingService(
          new PostgresReportRepository(asAcademyDatabase<ReportingDatabase>(client)),
        );
        return service.exportIpedsCsv(actor);
      });
      return new Response(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="churchcore-ipeds-review-required.csv"`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate IPEDS export.";
      if (error instanceof AcademyAuthenticationError) {
        return jsonError(message, 401);
      }
      if (error instanceof AcademyAuthorizationError || message.includes("Forbidden")) {
        return jsonError(message, 403);
      }
      return Response.json({ error: "Unable to generate IPEDS export." }, { status: 500 });
    }
  }

  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    assertReportingAccess(actor);
    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresReportRepository(
        asAcademyDatabase<ReportingDatabase>(client),
      );
      return generateIpedsExportFromDataset(await repository.readDataset(actor.tenantId));
    });
  });
}
