import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { createLearnerIntelligenceService } from "@/app/api/academy/learner-intelligence/service-factory";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { LearnerActivityEventInput } from "@/modules/learner-intelligence/types";

export interface LearnerIntelligenceEventRecorder {
  recordActivityEvent(actor: AcademyActor, input: LearnerActivityEventInput): Promise<void>;
}

function parseEventInput(body: unknown, tenantId: string): LearnerActivityEventInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid learner activity event payload.");
  }

  const payload = body as Record<string, unknown>;
  const learnerId = typeof payload.learnerId === "string" ? payload.learnerId : "";
  const eventType = typeof payload.eventType === "string" ? payload.eventType : "";

  if (!learnerId || !eventType) {
    throw new Error("learnerId and eventType are required.");
  }

  return {
    tenantId,
    learnerId,
    eventType: eventType as LearnerActivityEventInput["eventType"],
    metadata: (payload.metadata as Record<string, unknown> | undefined) ?? {},
    courseId: typeof payload.courseId === "string" ? payload.courseId : undefined,
    sectionId: typeof payload.sectionId === "string" ? payload.sectionId : undefined,
    moduleId: typeof payload.moduleId === "string" ? payload.moduleId : undefined,
    occurredAt: typeof payload.occurredAt === "string" ? payload.occurredAt : undefined,
  };
}

export async function submitLearnerActivityEventRequest(
  request: Request,
  service: LearnerIntelligenceEventRecorder,
  actor: AcademyActor,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }

  let input: LearnerActivityEventInput;
  try {
    input = parseEventInput(body, actor.tenantId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid learner activity event payload.";
    return jsonError(message, 400);
  }

  return handleApi(async () => {
    await service.recordActivityEvent(actor, input);
    return { ok: true };
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, (client) =>
      submitLearnerActivityEventRequest(
        request,
        createLearnerIntelligenceService(client),
        actor,
      ),
    );
  });
}
