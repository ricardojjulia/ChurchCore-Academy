import { jsonError } from "@/app/api/academy/api-utils";
import { createLearnerIntelligenceService } from "@/app/api/academy/learner-intelligence/service-factory";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  LearnerInterventionRecord,
  LearnerInterventionStatus,
  LearnerInterventionStatusUpdateInput,
} from "@/modules/learner-intelligence/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export interface LearnerInterventionStatusUpdater {
  updateInterventionStatus(
    actor: AcademyActor,
    tenantId: string,
    interventionId: string,
    input: LearnerInterventionStatusUpdateInput,
  ): Promise<LearnerInterventionRecord>;
}

const allowedStatuses = new Set<LearnerInterventionStatus>([
  "pending",
  "reviewed",
  "acted_on",
  "dismissed",
  "expired",
]);

function parseStatusUpdateInput(body: unknown): LearnerInterventionStatusUpdateInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid intervention status payload.");
  }

  const payload = body as Record<string, unknown>;
  const status = typeof payload.status === "string" ? payload.status : "";
  if (!allowedStatuses.has(status as LearnerInterventionStatus)) {
    throw new Error("status must be one of: pending, reviewed, acted_on, dismissed, expired.");
  }

  const instructorNotes = typeof payload.instructorNotes === "string" ? payload.instructorNotes : undefined;
  const expectedCurrentStatus =
    typeof payload.expectedCurrentStatus === "string" ? payload.expectedCurrentStatus : undefined;

  if (!expectedCurrentStatus) {
    throw new Error("expectedCurrentStatus is required.");
  }

  if (!allowedStatuses.has(expectedCurrentStatus as LearnerInterventionStatus)) {
    throw new Error("expectedCurrentStatus must be one of: pending, reviewed, acted_on, dismissed, expired.");
  }

  return {
    status: status as LearnerInterventionStatus,
    instructorNotes,
    expectedCurrentStatus: expectedCurrentStatus as LearnerInterventionStatus | undefined,
  };
}

export async function updateInterventionStatusForActor(
  service: LearnerInterventionStatusUpdater,
  actor: AcademyActor,
  interventionId: string,
  input: LearnerInterventionStatusUpdateInput,
) {
  return service.updateInterventionStatus(actor, actor.tenantId, interventionId, input);
}

export async function POST(
  request: Request,
  context: RouteContext,
  service?: LearnerInterventionStatusUpdater,
  resolvedActor?: AcademyActor,
): Promise<Response> {
  const actor = resolvedActor ?? (await resolveAcademyActorFromSession(request)).actor;
  if (!service) {
    return withAcademyDatabaseContext(actor, (client) =>
      POST(request, context, createLearnerIntelligenceService(client), actor),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }

  let input: LearnerInterventionStatusUpdateInput;
  try {
    input = parseStatusUpdateInput(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid intervention status payload.";
    return jsonError(message, 400);
  }

  try {
    const { id } = await context.params;
    const intervention = await updateInterventionStatusForActor(service, actor, id, input);
    return Response.json({ intervention });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected learner intelligence error.";
    const status = message.includes("Forbidden")
      ? 403
      : message.includes("Conflict")
        ? 409
        : message.includes("not found")
          ? 404
          : message.includes("required") || message.includes("invalid") || message.includes("must") || message.includes("transition")
            ? 400
            : 500;
    return jsonError(message, status);
  }
}
