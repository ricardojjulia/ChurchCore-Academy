import { handleApi, getStringParam } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  recordFederalDisbursement,
  getFederalDisbursementReport,
  type FederalAidDatabase,
} from "@/modules/financial-aid/federal-aid";

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function amount(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error("disbursementAmountCents must be a positive integer.");
  }
  return Number(value);
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { searchParams } = new URL(request.url);
    const reportingPeriod = getStringParam(searchParams.get("reportingPeriod") ?? undefined);

    if (!reportingPeriod) {
      throw new Error("reportingPeriod query parameter is required.");
    }

    return withAcademyDatabaseContext(actor, (client) =>
      getFederalDisbursementReport(actor, reportingPeriod, asAcademyDatabase<FederalAidDatabase>(client)),
    );
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = (await request.json()) as Record<string, unknown>;

    return withAcademyDatabaseContext(actor, (client) =>
      recordFederalDisbursement(
        actor,
        {
          reportingPeriod: text(body.reportingPeriod, "reportingPeriod"),
          programCode: text(body.programCode, "programCode"),
          studentPersonId: text(body.studentPersonId, "studentPersonId"),
          disbursementAmountCents: amount(body.disbursementAmountCents),
          disbursementDate: text(body.disbursementDate, "disbursementDate"),
          codReference: optionalText(body.codReference),
        },
        asAcademyDatabase<FederalAidDatabase>(client),
      ),
    );
  });
}
