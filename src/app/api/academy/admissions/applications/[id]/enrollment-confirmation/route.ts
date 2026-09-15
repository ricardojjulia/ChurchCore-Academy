import { randomUUID } from "node:crypto";
import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { requireIdempotencyKey } from "@/app/api/academy/admissions/request-utils";
import {
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyActor, assertCapability } from "@/modules/academy-auth/policy";
import {
  CourseRegistrationDatabase,
  PostgresCourseRegistrationRepository,
} from "@/modules/course-registration/postgres-repository";
import { CourseRegistrationService } from "@/modules/course-registration/service";
import { CourseRegistrationResult } from "@/modules/course-registration/types";

type RouteContext = { params: Promise<{ id: string }> };

interface EnrollmentConfirmationDependencies {
  resolveActor(request: Request): Promise<AcademyActor>;
  confirm(
    actor: AcademyActor,
    input: {
      applicationId: string;
      courseSectionId: string;
      confirmationNote?: string;
      idempotencyKey: string;
      correlationId: string;
    },
  ): Promise<CourseRegistrationResult>;
}

const confirmationDependencies: EnrollmentConfirmationDependencies = {
  resolveActor: async (request) =>
    (await resolveAcademyActorFromSession(request)).actor,
  confirm: async (actor, input) =>
    withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      return new CourseRegistrationService(
        new PostgresCourseRegistrationRepository(
          asAcademyDatabase<CourseRegistrationDatabase>(client),
        ),
      ).registerAndConfirm(actor, {
        tenantId: actor.tenantId,
        applicationId: input.applicationId,
        courseSectionId: input.courseSectionId,
        confirmationNote: input.confirmationNote,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
      });
    }),
};

export async function POST(request: Request, context: RouteContext) {
  return confirmEnrollmentRequest(request, context);
}

export async function confirmEnrollmentRequest(
  request: Request,
  context: RouteContext,
  dependencies: EnrollmentConfirmationDependencies = confirmationDependencies,
) {
  let idempotencyKey: string;
  try {
    idempotencyKey = requireIdempotencyKey(request.headers);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Idempotency-Key is required.",
      400,
    );
  }
  const correlationId =
    request.headers.get("x-correlation-id")?.trim() ||
    `corr-enrollment-confirmation-${randomUUID()}`;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }

  if (!body || typeof body !== "object") {
    return jsonError("Invalid enrollment confirmation payload.", 400);
  }

  const payload = body as Record<string, unknown>;
  const courseSectionId =
    typeof payload.courseSectionId === "string"
      ? payload.courseSectionId.trim()
      : "";
  const confirmationNote =
    typeof payload.confirmationNote === "string"
      ? payload.confirmationNote.trim() || undefined
      : undefined;

  if (!courseSectionId) {
    return jsonError("courseSectionId is required.", 400);
  }

  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
    const { id } = await context.params;

    const result = await dependencies.confirm(actor, {
      applicationId: id,
      courseSectionId,
      confirmationNote,
      idempotencyKey,
      correlationId,
    });

    return {
      applicationId: result.applicationId,
      registrationId: result.registrationId,
      studentProfileId: result.studentProfileId,
      studentPersonId: result.studentPersonId,
      programEnrollmentId: result.programEnrollmentId,
      periodRegistrationId: result.periodRegistrationId,
      courseSectionId: result.courseSectionId,
      registeredAt: result.registeredAt,
      confirmedAt: result.confirmedAt,
    };
  });
}
