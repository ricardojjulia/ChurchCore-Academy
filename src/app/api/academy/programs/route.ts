import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresAcademicProgramRepository,
  type AcademicProgramDatabase,
} from "@/modules/academic-programs/postgres-repository";
import { validateCreateProgramInput } from "@/modules/academic-programs/types";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const mode = searchParams.get("mode") ?? undefined;

    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const repo = new PostgresAcademicProgramRepository(
        asAcademyDatabase<AcademicProgramDatabase>(client),
      );
      return repo.list(actor.tenantId, {
        status: status as never,
        institutionMode: mode as never,
      });
    });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    const input = validateCreateProgramInput({
      tenantId: actor.tenantId,
      programCode: typeof body.programCode === "string" ? body.programCode : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      shortTitle: typeof body.shortTitle === "string" ? body.shortTitle : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      institutionMode: typeof body.institutionMode === "string" ? body.institutionMode as never : undefined,
      credentialType: typeof body.credentialType === "string" ? body.credentialType as never : undefined,
      gradeBand: typeof body.gradeBand === "string" ? body.gradeBand as never : undefined,
      subdivisionId: typeof body.subdivisionId === "string" ? body.subdivisionId : undefined,
      requiredCredits: typeof body.requiredCredits === "number" ? body.requiredCredits : undefined,
      requiredClockHours: typeof body.requiredClockHours === "number" ? body.requiredClockHours : undefined,
      requiredCompetencies: typeof body.requiredCompetencies === "number" ? body.requiredCompetencies : undefined,
      typicalDurationPeriods: typeof body.typicalDurationPeriods === "number" ? body.typicalDurationPeriods : undefined,
      effectiveFrom: typeof body.effectiveFrom === "string" ? body.effectiveFrom : undefined,
      effectiveTo: typeof body.effectiveTo === "string" ? body.effectiveTo : undefined,
      createdByPersonId: actor.userId,
    });

    return withAcademyDatabaseContext(actor, async (client) => {
      const repo = new PostgresAcademicProgramRepository(
        asAcademyDatabase<AcademicProgramDatabase>(client),
      );
      return repo.create(input);
    });
  });
}
