import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  registerFederalProgram,
  listFederalPrograms,
  type FederalAidDatabase,
} from "@/modules/financial-aid/federal-aid";

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function optionalAmount(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error("maxAnnualAwardCents must be a positive integer.");
  }
  return Number(value);
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, (client) =>
      listFederalPrograms(actor, asAcademyDatabase<FederalAidDatabase>(client)),
    );
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = (await request.json()) as Record<string, unknown>;

    return withAcademyDatabaseContext(actor, (client) =>
      registerFederalProgram(
        actor,
        {
          programCode: text(body.programCode, "programCode"),
          programName: text(body.programName, "programName"),
          opeid: optionalText(body.opeid),
          maxAnnualAwardCents: optionalAmount(body.maxAnnualAwardCents),
        },
        asAcademyDatabase<FederalAidDatabase>(client),
      ),
    );
  });
}
