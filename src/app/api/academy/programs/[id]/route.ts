import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresAcademicProgramRepository,
  type AcademicProgramDatabase,
} from "@/modules/academic-programs/postgres-repository";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const repo = new PostgresAcademicProgramRepository(
        asAcademyDatabase<AcademicProgramDatabase>(client),
      );
      const program = await repo.findById(actor.tenantId, id);
      if (!program) throw new Error(`Program ${id} was not found.`);
      return program;
    });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const repo = new PostgresAcademicProgramRepository(
        asAcademyDatabase<AcademicProgramDatabase>(client),
      );
      return repo.update(actor.tenantId, id, {
        title: typeof body.title === "string" ? body.title : undefined,
        shortTitle: typeof body.shortTitle === "string" ? body.shortTitle : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        gradeBand: typeof body.gradeBand === "string" ? body.gradeBand as never : undefined,
        subdivisionId: typeof body.subdivisionId === "string" ? body.subdivisionId : undefined,
        requiredCredits: typeof body.requiredCredits === "number" ? body.requiredCredits : undefined,
        requiredClockHours: typeof body.requiredClockHours === "number" ? body.requiredClockHours : undefined,
        requiredCompetencies: typeof body.requiredCompetencies === "number" ? body.requiredCompetencies : undefined,
        typicalDurationPeriods: typeof body.typicalDurationPeriods === "number" ? body.typicalDurationPeriods : undefined,
        status: typeof body.status === "string" ? body.status as never : undefined,
        effectiveFrom: typeof body.effectiveFrom === "string" ? body.effectiveFrom : undefined,
        effectiveTo: typeof body.effectiveTo === "string" ? body.effectiveTo : undefined,
      });
    });
  });
}
