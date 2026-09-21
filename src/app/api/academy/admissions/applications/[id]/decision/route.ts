import { randomUUID } from "node:crypto";
import { handleApi } from "@/app/api/academy/api-utils";
import {
  parseAdmissionDecision,
  requireIdempotencyKey,
  toAdmissionApplicationResponse,
} from "@/app/api/academy/admissions/request-utils";
import {
  createAdmissionsService,
  createDocumentChecklistService,
} from "@/app/api/academy/admissions/service-factory";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyActor, assertCapability } from "@/modules/academy-auth/policy";
import { AdmissionApplication } from "@/modules/admissions/types";

type RouteContext = { params: Promise<{ id: string }> };

interface DecideAdmissionApplicationDependencies {
  resolveActor(request: Request): Promise<AcademyActor>;
  checkCanAdvanceToDecision(
    actor: AcademyActor,
    applicationId: string,
  ): Promise<{ complete: boolean; missingLabels: string[] }>;
  decide(
    actor: AcademyActor,
    applicationId: string,
    decision: "accepted" | "declined",
    reason: string | undefined,
    correlationId: string,
    idempotencyKey: string,
  ): Promise<AdmissionApplication>;
}

const decisionDependencies: DecideAdmissionApplicationDependencies = {
  resolveActor: async (request) =>
    (await resolveAcademyActorFromSession(request)).actor,
  checkCanAdvanceToDecision: async (actor, applicationId) =>
    withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      return createDocumentChecklistService(client).canAdvanceToDecision(
        actor,
        applicationId,
      );
    }),
  decide: async (
    actor,
    applicationId,
    decision,
    reason,
    correlationId,
    idempotencyKey,
  ) =>
    withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      return createAdmissionsService(client).decide(
        actor,
        applicationId,
        decision,
        reason,
        correlationId,
        idempotencyKey,
      );
    }),
};

export async function POST(request: Request, context: RouteContext) {
  return decideAdmissionApplicationRequest(request, context);
}

export async function decideAdmissionApplicationRequest(
  request: Request,
  context: RouteContext,
  dependencies: DecideAdmissionApplicationDependencies = decisionDependencies,
) {
  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => {
      throw new Error("Malformed JSON body.");
    });
    const { decision, reason } = parseAdmissionDecision(body);
    const idempotencyKey = requireIdempotencyKey(request.headers);
    const correlationId =
      request.headers.get("x-correlation-id")?.trim() ||
      `corr-admission-${randomUUID()}`;

    // Only "accepted" requires a complete document checklist — declining an application
    // doesn't depend on the applicant having finished submitting documents.
    if (decision === "accepted") {
      const completion = await dependencies.checkCanAdvanceToDecision(actor, id);
      if (!completion.complete) {
        throw new Error(
          `Required documents must be received or waived before this application can be accepted: ${completion.missingLabels.join(", ")}.`,
        );
      }
    }

    return {
      application: toAdmissionApplicationResponse(
        await dependencies.decide(
          actor,
          id,
          decision,
          reason,
          correlationId,
          idempotencyKey,
        ),
      ),
    };
  });
}
