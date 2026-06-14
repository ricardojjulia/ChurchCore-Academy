import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { createLearnerIntelligenceService } from "@/app/api/academy/learner-intelligence/service-factory";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { LearnerIntelligenceConsentInput } from "@/modules/learner-intelligence/types";

export interface LearnerIntelligenceConsentWriter {
  upsertConsent(actor: AcademyActor, input: LearnerIntelligenceConsentInput): Promise<void>;
}

function parseConsentInput(body: unknown, tenantId: string): LearnerIntelligenceConsentInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid learner intelligence consent payload.");
  }

  const payload = body as Record<string, unknown>;
  const learnerId = typeof payload.learnerId === "string" ? payload.learnerId : "";
  const consentVersion = typeof payload.consentVersion === "string" ? payload.consentVersion : "";

  if (!learnerId || !consentVersion) {
    throw new Error("learnerId and consentVersion are required.");
  }

  const booleanFlag = (value: unknown) => value === true;

  return {
    tenantId,
    learnerId,
    consentVersion,
    consentBehavioralTracking: booleanFlag(payload.consentBehavioralTracking),
    consentAiMemory: booleanFlag(payload.consentAiMemory),
    consentSocialGraph: booleanFlag(payload.consentSocialGraph),
    consentPredictiveModeling: booleanFlag(payload.consentPredictiveModeling),
    consentLearnerMirror: booleanFlag(payload.consentLearnerMirror),
    consentedAt: typeof payload.consentedAt === "string" ? payload.consentedAt : undefined,
  };
}

export async function submitLearnerConsentRequest(
  request: Request,
  service: LearnerIntelligenceConsentWriter,
  actor: AcademyActor,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }

  let input: LearnerIntelligenceConsentInput;
  try {
    input = parseConsentInput(body, actor.tenantId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid learner intelligence consent payload.";
    return jsonError(message, 400);
  }

  return handleApi(async () => {
    await service.upsertConsent(actor, input);
    return { ok: true };
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, (client) =>
      submitLearnerConsentRequest(
        request,
        createLearnerIntelligenceService(client),
        actor,
      ),
    );
  });
}
