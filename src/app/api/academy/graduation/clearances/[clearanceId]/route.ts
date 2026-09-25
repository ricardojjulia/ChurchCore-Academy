import { handleApi, requireStringField } from "@/app/api/academy/api-utils";
import {
  withAcademyDatabaseContext,
  asAcademyDatabase,
  AcademyQueryClient,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyActor } from "@/modules/academy-auth/policy";
import {
  PostgresGraduationClearanceRepository,
  GraduationDatabase,
} from "@/modules/graduation/postgres-repository";
import { GraduationClearanceService } from "@/modules/graduation/service";
import { GraduationClearance, UpdateClearanceInput } from "@/modules/graduation/types";

type RouteContext = { params: Promise<{ clearanceId: string }> };

// ---------------------------------------------------------------------------
// Dependency interface — lets tests swap implementations without real DB
// ---------------------------------------------------------------------------

interface UpdateClearanceDependencies {
  resolveActor(request: Request): Promise<AcademyActor>;
  updateClearance(
    actor: AcademyActor,
    input: UpdateClearanceInput,
  ): Promise<GraduationClearance>;
}

function buildService(client: AcademyQueryClient): GraduationClearanceService {
  const repo = new PostgresGraduationClearanceRepository(
    asAcademyDatabase<GraduationDatabase>(client),
  );
  return new GraduationClearanceService(repo);
}

const defaultDependencies: UpdateClearanceDependencies = {
  resolveActor: async (request) =>
    (await resolveAcademyActorFromSession(request)).actor,

  updateClearance: (actor, input) =>
    withAcademyDatabaseContext(actor, async (client) => {
      return buildService(client).update(actor, input);
    }),
};

// ---------------------------------------------------------------------------
// PATCH /api/academy/graduation/clearances/[clearanceId]
// Body: { action: "clear" | "defer", notes?: string, deferredReason?: string }
// Returns: updated GraduationClearance (200)
// ---------------------------------------------------------------------------

export async function PATCH(request: Request, context: RouteContext) {
  return patchClearanceRequest(request, context);
}

export async function patchClearanceRequest(
  request: Request,
  context: RouteContext,
  dependencies: UpdateClearanceDependencies = defaultDependencies,
) {
  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
    const { clearanceId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const action = body.action;
    if (action !== "clear" && action !== "defer") {
      throw new Error(
        "Invalid action: must be 'clear' or 'defer'.",
      );
    }

    const input: UpdateClearanceInput = {
      clearanceId: requireStringField(clearanceId, "clearanceId"),
      action,
      notes:
        typeof body.notes === "string" && body.notes.trim().length > 0
          ? body.notes
          : undefined,
      deferredReason:
        typeof body.deferredReason === "string" &&
        body.deferredReason.trim().length > 0
          ? body.deferredReason
          : undefined,
    };

    const clearance = await dependencies.updateClearance(actor, input);

    return clearance;
  });
}
