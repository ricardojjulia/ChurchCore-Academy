import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { createLearnerIntelligenceService } from "@/app/api/academy/learner-intelligence/service-factory";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { LearnerMemoryEntryRecord } from "@/modules/learner-intelligence/types";

export interface LearnerIntelligenceMemoryReader {
  listMemoryEntries(actor: AcademyActor, tenantId: string, learnerId: string, limit?: number): Promise<LearnerMemoryEntryRecord[]>;
}

function parseLimitParam(value: string | null) {
  if (!value) {
    return 25;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error("limit must be a positive integer.");
  }

  return parsed;
}

export async function getLearnerMemoryRequest(
  request: Request,
  service: LearnerIntelligenceMemoryReader,
  actor: AcademyActor,
) {
  const { searchParams } = new URL(request.url);
  const learnerId = searchParams.get("learnerId");

  if (!learnerId) {
    return jsonError("learnerId query parameter is required.", 400);
  }

  let limit: number;
  try {
    limit = parseLimitParam(searchParams.get("limit"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid query parameters.";
    return jsonError(message, 400);
  }

  try {
    const memory = await service.listMemoryEntries(actor, actor.tenantId, learnerId, limit);
    return jsonOk({ memory });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected learner intelligence error.";
    const status = message.includes("Forbidden") ? 403 : 500;
    return jsonError(message, status);
  }
}

export async function GET(request: Request) {
  const { actor } = await resolveAcademyActorFromSession(request);
  return withAcademyDatabaseContext(actor, (client) =>
    getLearnerMemoryRequest(
      request,
      createLearnerIntelligenceService(client),
      actor,
    ),
  );
}
