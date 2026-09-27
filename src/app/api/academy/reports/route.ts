import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import {
  AcademyAuthenticationError,
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { CustomReportDefinitionInput } from "@/modules/reporting/types";
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
  serviceForActor?: (
    actor: AcademyActor
  ) => Promise<Pick<ReportingService, "readDashboard" | "exportCsv" | "exportCustomCsv" | "createCustomReport">>;
}

async function defaultServiceForActor(actor: AcademyActor) {
  return withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresReportRepository(
      asAcademyDatabase<ReportingDatabase>(client),
    );
    return new ReportingService(repository, repository);
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
  const lowerMessage = message.toLowerCase();

  if (error instanceof AcademyAuthenticationError) {
    return Response.json({ error: message }, { status: 401 });
  }
  if (error instanceof AcademyAuthorizationError || message.includes("Forbidden")) {
    return Response.json({ error: message }, { status: 403 });
  }
  if (error instanceof AcademyConflictError) {
    return Response.json({ error: message }, { status: 409 });
  }
  if (lowerMessage.includes("not found") || lowerMessage.includes("was not found")) {
    return Response.json({ error: message }, { status: 404 });
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
      const reportIdParam = url.searchParams.get("report");
      const customReportId = url.searchParams.get("customReportId");
      const service = await (
        dependencies.serviceForActor ?? defaultServiceForActor
      )(actor);
      const reportId = customReportId ? undefined : parseReportId(reportIdParam);
      const csv = customReportId
        ? await service.exportCustomCsv(actor, customReportId)
        : await service.exportCsv(actor, reportId!);
      const fileSlug = customReportId
        ? `custom-${customReportId}`
        : reportId!.replaceAll("_", "-");
      return new Response(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="churchcore-${fileSlug}-report.csv"`,
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

export async function createCustomReport(
  request: Request,
  dependencies: ReportRouteDependencies = {},
) {
  return handleApi(async () => {
    const actor = await resolveActor(request, dependencies);
    assertReportingAccess(actor);
    const body = await request.json() as CustomReportDefinitionInput;
    const service = await (
      dependencies.serviceForActor ?? defaultServiceForActor
    )(actor);
    return {
      customReport: await service.createCustomReport(actor, body),
    };
  });
}

export async function POST(request: Request) {
  return createCustomReport(request);
}
