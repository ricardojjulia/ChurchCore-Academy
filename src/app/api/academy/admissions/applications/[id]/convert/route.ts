import { randomUUID } from "node:crypto";
import { handleApi } from "@/app/api/academy/api-utils";
import { requireIdempotencyKey } from "@/app/api/academy/admissions/request-utils";
import { createEnrollmentConversionService } from "@/app/api/academy/admissions/service-factory";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyActor, assertCapability } from "@/modules/academy-auth/policy";
import { EnrollmentConversionResult } from "@/modules/enrollment-conversion/types";

type RouteContext = { params: Promise<{ id: string }> };

interface ConvertAdmissionApplicationDependencies {
  resolveActor(request: Request): Promise<AcademyActor>;
  convert(
    actor: AcademyActor,
    applicationId: string,
    correlationId: string,
    idempotencyKey: string,
  ): Promise<EnrollmentConversionResult>;
}

const conversionDependencies: ConvertAdmissionApplicationDependencies = {
  resolveActor: async (request) =>
    (await resolveAcademyActorFromSession(request)).actor,
  convert: async (
    actor,
    applicationId,
    correlationId,
    idempotencyKey,
  ) =>
    withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");
      return createEnrollmentConversionService(client).convert(
        actor,
        applicationId,
        correlationId,
        idempotencyKey,
      );
    }),
};

export async function POST(request: Request, context: RouteContext) {
  return convertAdmissionApplicationRequest(request, context);
}

export async function convertAdmissionApplicationRequest(
  request: Request,
  context: RouteContext,
  dependencies: ConvertAdmissionApplicationDependencies =
    conversionDependencies,
) {
  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
    const { id } = await context.params;
    const idempotencyKey = requireIdempotencyKey(request.headers);
    const correlationId =
      request.headers.get("x-correlation-id")?.trim() ||
      `corr-enrollment-conversion-${randomUUID()}`;
    const result = await dependencies.convert(
      actor,
      id,
      correlationId,
      idempotencyKey,
    );

    return {
      applicationId: result.applicationId,
      studentProfileId: result.studentProfileId,
      studentNumber: result.studentNumber,
      programEnrollmentId: result.programEnrollmentId,
      periodRegistrationId: result.periodRegistrationId,
      convertedAt: result.convertedAt,
    };
  });
}
