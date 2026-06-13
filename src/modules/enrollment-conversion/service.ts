import { AcademyConflictError } from "@/modules/academy-auth/errors";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuditEventInput } from "@/modules/audit/types";
import { evaluateEnrollmentConversionEligibility } from "@/modules/enrollment-conversion/eligibility";
import { assertEnrollmentConversionAccess } from "@/modules/enrollment-conversion/policy";
import { EnrollmentConversionRepository } from "@/modules/enrollment-conversion/types";

interface AuditRepository {
  append(input: AcademyAuditEventInput): Promise<unknown>;
}

export class EnrollmentConversionService {
  constructor(
    private readonly repository: EnrollmentConversionRepository,
    private readonly audit: AuditRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async convert(
    actor: AcademyActor,
    applicationId: string,
    correlationId: string,
    idempotencyKey: string,
  ) {
    assertEnrollmentConversionAccess(actor, actor.tenantId);

    const replay = await this.repository.findReplay(
      actor.tenantId,
      idempotencyKey,
    );
    if (replay) {
      if (replay.applicationId !== applicationId) {
        throw new AcademyConflictError(
          "Idempotency key was already used for another enrollment conversion.",
        );
      }
      return replay;
    }

    const application = await this.repository.findApplication(
      actor.tenantId,
      applicationId,
    );
    if (!application) {
      throw new Error(
        `Admission application ${applicationId} was not found.`,
      );
    }
    assertEnrollmentConversionAccess(actor, application.tenantId);

    const eligibility =
      evaluateEnrollmentConversionEligibility(application);
    if (eligibility.kind === "blocked") {
      throw new AcademyConflictError(eligibility.reason);
    }
    if (eligibility.kind === "already_converted") {
      const existing =
        await this.repository.findResultByApplication(
          actor.tenantId,
          applicationId,
        );
      if (!existing) {
        throw new AcademyConflictError(
          "Application conversion metadata is incomplete.",
        );
      }
      throw new AcademyConflictError(
        "Application was already converted with another idempotency key.",
      );
    }

    const result = await this.repository.convert({
      tenantId: actor.tenantId,
      applicationId,
      actorPersonId: actor.userId,
      convertedAt: this.now(),
      correlationId,
      idempotencyKey,
    });

    await this.audit.append({
      tenantId: actor.tenantId,
      actorPersonId: actor.userId,
      action: "admission.application.converted",
      entityType: "admission_application",
      entityId: applicationId,
      resultStatus: "converted",
      correlationId,
      idempotencyKey,
      redactedMetadata: {
        studentProfileId: result.studentProfileId,
        programEnrollmentId: result.programEnrollmentId,
        periodRegistrationId: result.periodRegistrationId,
      },
    });

    return result;
  }
}
