import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { createLearnerIntelligenceService } from "@/app/api/academy/learner-intelligence/service-factory";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { LearnerInterventionStatusHistoryRecord } from "@/modules/learner-intelligence/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export interface LearnerInterventionHistoryReader {
  listInterventionStatusHistory(
    actor: AcademyActor,
    tenantId: string,
    interventionId: string,
    limit?: number,
  ): Promise<LearnerInterventionStatusHistoryRecord[]>;
}

function parseLimit(value: string | null) {
  if (!value) {
    return 25;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error("limit must be a positive integer.");
  }

  return parsed;
}

export async function GET(
  request: Request,
  context: RouteContext,
  service?: LearnerInterventionHistoryReader,
  resolvedActor?: AcademyActor,
): Promise<Response> {
  const actor = resolvedActor ?? (await resolveAcademyActorFromSession(request)).actor;
  if (!service) {
    return withAcademyDatabaseContext(actor, (client) =>
      GET(request, context, createLearnerIntelligenceService(client), actor),
    );
  }
  const { searchParams } = new URL(request.url);

  let limit: number;
  try {
    limit = parseLimit(searchParams.get("limit"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid query parameters.";
    return jsonError(message, 400);
  }

  try {
    const { id } = await context.params;
    const history = await service.listInterventionStatusHistory(actor, actor.tenantId, id, limit);
    return jsonOk({ history, count: history.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected learner intelligence error.";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 500;
    return jsonError(message, status);
  }
}
