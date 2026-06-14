import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { createLearnerIntelligenceService } from "@/app/api/academy/learner-intelligence/service-factory";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  LearnerConsentRevocationInput,
  LearnerIntelligenceConsentInput,
  LearnerIntelligenceConsentRecord,
} from "@/modules/learner-intelligence/types";

export interface LearnerIntelligenceConsentWriter {
  upsertConsent(actor: AcademyActor, input: LearnerIntelligenceConsentInput): Promise<void>;
}

export interface LearnerIntelligenceConsentReader {
  getConsent(actor: AcademyActor, tenantId: string, learnerId: string): Promise<LearnerIntelligenceConsentRecord | null>;
  listConsentHistory(
    actor: AcademyActor,
    tenantId: string,
    learnerId: string,
    limit?: number,
  ): Promise<LearnerIntelligenceConsentRecord[]>;
}

export interface LearnerIntelligenceConsentRevoker {
  revokeConsent(actor: AcademyActor, input: LearnerConsentRevocationInput): Promise<LearnerIntelligenceConsentRecord>;
}

function parseConsentInput(body: unknown, tenantId: string, actorPersonId: string): LearnerIntelligenceConsentInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid learner intelligence consent payload.");
  }

  const payload = body as Record<string, unknown>;
  const learnerId = typeof payload.learnerId === "string" && payload.learnerId.trim()
    ? payload.learnerId.trim()
    : actorPersonId;
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
    input = parseConsentInput(body, actor.tenantId, actor.userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid learner intelligence consent payload.";
    return jsonError(message, 400);
  }

  return handleApi(async () => {
    await service.upsertConsent(actor, input);
    return { ok: true };
  });
}

export async function getLearnerConsentRequest(
  request: Request,
  service: LearnerIntelligenceConsentReader,
  actor: AcademyActor,
) {
  const { searchParams } = new URL(request.url);
  const learnerId = searchParams.get("learnerId")?.trim() || actor.userId;
  const includeHistory = searchParams.get("includeHistory") === "true";
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 25;

  if (!Number.isInteger(limit) || limit < 1) {
    return jsonError("limit must be a positive integer.", 400);
  }

  return handleApi(async () => ({
    current: await service.getConsent(actor, actor.tenantId, learnerId),
    history: includeHistory
      ? await service.listConsentHistory(actor, actor.tenantId, learnerId, limit)
      : undefined,
  }));
}

export async function revokeLearnerConsentRequest(
  request: Request,
  service: LearnerIntelligenceConsentRevoker,
  actor: AcademyActor,
) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const learnerId = typeof body?.learnerId === "string" && body.learnerId.trim()
    ? body.learnerId.trim()
    : actor.userId;
  const consentVersion = typeof body?.consentVersion === "string" ? body.consentVersion.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!consentVersion || !reason) {
    return jsonError("consentVersion and reason are required.", 400);
  }

  return handleApi(async () => ({
    consent: await service.revokeConsent(actor, {
      tenantId: actor.tenantId,
      learnerId,
      consentVersion,
      reason,
    }),
  }));
}

async function runWithLearnerIntelligenceService(
  request: Request,
  operation: (
    actor: AcademyActor,
    service: ReturnType<typeof createLearnerIntelligenceService>,
  ) => Promise<Response>,
) {
  try {
    const { actor } = await resolveAcademyActorFromSession(request);
    return await withAcademyDatabaseContext(actor, (client) =>
      operation(actor, createLearnerIntelligenceService(client)),
    );
  } catch (error) {
    return handleApi(async () => {
      throw error;
    });
  }
}

export async function POST(request: Request) {
  return runWithLearnerIntelligenceService(request, (actor, service) =>
    submitLearnerConsentRequest(request, service, actor),
  );
}

export async function GET(request: Request) {
  return runWithLearnerIntelligenceService(request, (actor, service) =>
    getLearnerConsentRequest(request, service, actor),
  );
}

export async function DELETE(request: Request) {
  return runWithLearnerIntelligenceService(request, (actor, service) =>
    revokeLearnerConsentRequest(request, service, actor),
  );
}
