import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { createLearnerIntelligenceService } from "@/app/api/academy/learner-intelligence/service-factory";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  LearnerInterventionQueryOptions,
  LearnerInterventionRecord,
  LearnerInterventionStatus,
} from "@/modules/learner-intelligence/types";

export interface LearnerIntelligenceInterventionReader {
  listInterventions(
    actor: AcademyActor,
    tenantId: string,
    options: Omit<LearnerInterventionQueryOptions, "limit"> & { limit?: number },
  ): Promise<LearnerInterventionRecord[]>;
}

const allowedStatuses = new Set<LearnerInterventionStatus>([
  "pending",
  "reviewed",
  "acted_on",
  "dismissed",
  "expired",
]);

function parseQueryParams(searchParams: URLSearchParams) {
  const learnerId = searchParams.get("learnerId") ?? undefined;
  const rawStatus = searchParams.get("status") ?? undefined;
  const rawLimit = searchParams.get("limit");

  let status: LearnerInterventionStatus | undefined;
  if (rawStatus) {
    if (!allowedStatuses.has(rawStatus as LearnerInterventionStatus)) {
      throw new Error("status must be one of: pending, reviewed, acted_on, dismissed, expired.");
    }

    status = rawStatus as LearnerInterventionStatus;
  }

  let limit: number | undefined;
  if (rawLimit) {
    const parsed = Number.parseInt(rawLimit, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      throw new Error("limit must be a positive integer.");
    }

    limit = parsed;
  }

  return {
    learnerId,
    status,
    limit,
  };
}

export async function getLearnerInterventionsRequest(
  request: Request,
  service: LearnerIntelligenceInterventionReader,
  actor: AcademyActor,
) {
  const { searchParams } = new URL(request.url);

  let options: Omit<LearnerInterventionQueryOptions, "limit"> & { limit?: number };
  try {
    options = parseQueryParams(searchParams);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid query parameters.";
    return jsonError(message, 400);
  }

  try {
    const interventions = await service.listInterventions(actor, actor.tenantId, options);
    return jsonOk({ interventions, count: interventions.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected learner intelligence error.";
    const status = message.includes("Forbidden") ? 403 : 500;
    return jsonError(message, status);
  }
}

export async function GET(request: Request) {
  const { actor } = await resolveAcademyActorFromSession(request);
  return withAcademyDatabaseContext(actor, (client) =>
    getLearnerInterventionsRequest(
      request,
      createLearnerIntelligenceService(client),
      actor,
    ),
  );
}
