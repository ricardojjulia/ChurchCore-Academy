import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import {
  AcademyAuthenticationError,
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  PostgresReportRepository,
  type ReportingDatabase,
} from "@/modules/reporting/postgres-repository";
import {
  assertReportingAccess,
  parseReportId,
  ReportingService,
} from "@/modules/reporting/service";

interface ReportRouteDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
  serviceForActor?: (actor: AcademyActor) => Promise<Pick<ReportingService, "readDashboard" | "exportCsv">>;
}

async function defaultServiceForActor(actor: AcademyActor) {
  return withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresReportRepository(
      asAcademyDatabase<ReportingDatabase>(client),
    );
    return new ReportingService(repository);
  });
}

async function resolveActor(request: Request, dependencies: ReportRouteDependencies) {
  return (
    dependencies.resolveActor ??
    (async (currentRequest) =>
      (await resolveAcademyActorFromSession(currentRequest)).actor)
  )(request);
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected API error.";

  if (error instanceof AcademyAuthenticationError) {
    return Response.json({ error: message }, { status: 401 });
  }
  if (error instanceof AcademyAuthorizationError || message.includes("Forbidden")) {
    return Response.json({ error: message }, { status: 403 });
  }
  if (error instanceof AcademyConflictError) {
    return Response.json({ error: message }, { status: 409 });
  }
  if (message.startsWith("Invalid ") || message.includes(" is required")) {
    return Response.json({ error: message }, { status: 400 });
  }
  return Response.json({ error: "Unexpected API error." }, { status: 500 });
}

export async function readReport(
  request: Request,
  dependencies: ReportRouteDependencies = {},
) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  if (format === "csv") {
    try {
      const actor = await resolveActor(request, dependencies);
      assertReportingAccess(actor);
      const reportId = parseReportId(url.searchParams.get("report"));
      const service = await (
        dependencies.serviceForActor ?? defaultServiceForActor
      )(actor);
      const csv = await service.exportCsv(actor, reportId);
      return new Response(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="churchcore-${reportId.replaceAll("_", "-")}-report.csv"`,
        },
      });
    } catch (error) {
      return errorResponse(error);
    }
  }

  return handleApi(async () => {
    const actor = await resolveActor(request, dependencies);
    assertReportingAccess(actor);
    const service = await (
      dependencies.serviceForActor ?? defaultServiceForActor
    )(actor);
    return service.readDashboard(actor);
  });
}

export async function GET(request: Request) {
  return readReport(request);
}
