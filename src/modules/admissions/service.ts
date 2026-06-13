import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyConflictError } from "@/modules/academy-auth/errors";
import {
  assertAdmissionsAccess,
} from "@/modules/admissions/policy";
import { assertAdmissionTransition } from "@/modules/admissions/transitions";
import {
  AdmissionApplication,
  AdmissionApplicationEventInput,
  AdmissionApplicationStatus,
  CreateAdmissionApplicationInput,
} from "@/modules/admissions/types";
import { AcademyAuditEventInput } from "@/modules/audit/types";

interface AdmissionsRepository {
  findById(
    tenantId: string,
    applicationId: string,
  ): Promise<AdmissionApplication | undefined>;
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<AdmissionApplication | undefined>;
  findMutationByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<
    | {
        application: AdmissionApplication;
        eventType: AdmissionApplicationEventInput["eventType"];
      }
    | undefined
  >;
  create(
    input: CreateAdmissionApplicationInput,
    actorPersonId: string,
    correlationId: string,
    idempotencyKey: string,
  ): Promise<AdmissionApplication>;
  transition(
    tenantId: string,
    applicationId: string,
    expectedStatus: AdmissionApplicationStatus,
    nextStatus: AdmissionApplicationStatus,
    decision?: {
      decidedAt: string;
      decidedByPersonId: string;
      decisionReason?: string;
    },
  ): Promise<AdmissionApplication | undefined>;
  appendEvent(event: AdmissionApplicationEventInput): Promise<void>;
}

interface AuditRepository {
  append(input: AcademyAuditEventInput): Promise<unknown>;
}

export class AdmissionsService {
  constructor(
    private readonly repository: AdmissionsRepository,
    private readonly audit: AuditRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async createDraft(
    actor: AcademyActor,
    input: CreateAdmissionApplicationInput,
    correlationId: string,
    idempotencyKey: string,
  ) {
    assertAdmissionsAccess(
      actor,
      input.tenantId,
      input.applicantPersonId,
      "create",
    );
    const existing = await this.repository.findByIdempotencyKey(
      actor.tenantId,
      idempotencyKey,
    );
    if (existing) {
      return existing;
    }

    const application = await this.repository.create(
      input,
      actor.userId,
      correlationId,
      idempotencyKey,
    );
    await this.recordMutation(
      actor,
      application,
      "created",
      undefined,
      "draft",
      correlationId,
      idempotencyKey,
    );
    return application;
  }

  async submit(
    actor: AcademyActor,
    applicationId: string,
    correlationId: string,
    idempotencyKey: string,
  ) {
    const application = await this.requireApplication(actor, applicationId);
    assertAdmissionsAccess(
      actor,
      application.tenantId,
      application.applicantPersonId,
      "submit",
    );
    const replay = await this.findMutationReplay(
      actor,
      application,
      "submitted",
      idempotencyKey,
    );
    if (replay) {
      return replay;
    }
    return this.transition(
      actor,
      application,
      "submitted",
      "submitted",
      correlationId,
      idempotencyKey,
    );
  }

  async decide(
    actor: AcademyActor,
    applicationId: string,
    decision: "accepted" | "declined",
    reason: string | undefined,
    correlationId: string,
    idempotencyKey: string,
  ) {
    const application = await this.requireApplication(actor, applicationId);
    assertAdmissionsAccess(
      actor,
      application.tenantId,
      application.applicantPersonId,
      "decide",
    );
    const replay = await this.findMutationReplay(
      actor,
      application,
      decision,
      idempotencyKey,
    );
    if (replay) {
      return replay;
    }
    return this.transition(
      actor,
      application,
      decision,
      decision,
      correlationId,
      idempotencyKey,
      {
        decidedAt: this.now(),
        decidedByPersonId: actor.userId,
        decisionReason: reason,
      },
    );
  }

  private async requireApplication(
    actor: AcademyActor,
    applicationId: string,
  ) {
    const application = await this.repository.findById(
      actor.tenantId,
      applicationId,
    );
    if (!application) {
      throw new Error(`Admission application ${applicationId} was not found.`);
    }
    return application;
  }

  private async transition(
    actor: AcademyActor,
    application: AdmissionApplication,
    nextStatus: AdmissionApplicationStatus,
    eventType: AdmissionApplicationEventInput["eventType"],
    correlationId: string,
    idempotencyKey: string,
    decision?: {
      decidedAt: string;
      decidedByPersonId: string;
      decisionReason?: string;
    },
  ) {
    assertAdmissionTransition(application.status, nextStatus);
    const updated = await this.repository.transition(
      application.tenantId,
      application.id,
      application.status,
      nextStatus,
      decision,
    );
    if (!updated) {
      throw new AcademyConflictError(
        "Admission application status changed concurrently.",
      );
    }
    await this.recordMutation(
      actor,
      updated,
      eventType,
      application.status,
      nextStatus,
      correlationId,
      idempotencyKey,
      decision?.decisionReason,
    );
    return updated;
  }

  private async findMutationReplay(
    actor: AcademyActor,
    application: AdmissionApplication,
    eventType: AdmissionApplicationEventInput["eventType"],
    idempotencyKey: string,
  ) {
    const mutation = await this.repository.findMutationByIdempotencyKey(
      actor.tenantId,
      idempotencyKey,
    );
    if (!mutation) {
      return undefined;
    }
    if (
      mutation.application.id !== application.id ||
      mutation.eventType !== eventType
    ) {
      throw new AcademyConflictError(
        "Idempotency key was already used for another admissions mutation.",
      );
    }
    return mutation.application;
  }

  private async recordMutation(
    actor: AcademyActor,
    application: AdmissionApplication,
    eventType: AdmissionApplicationEventInput["eventType"],
    previousStatus: AdmissionApplicationStatus | undefined,
    nextStatus: AdmissionApplicationStatus,
    correlationId: string,
    idempotencyKey: string,
    notes?: string,
  ) {
    await this.repository.appendEvent({
      tenantId: application.tenantId,
      applicationId: application.id,
      actorPersonId: actor.userId,
      eventType,
      previousStatus,
      nextStatus,
      redactedNotes: notes,
      correlationId,
      idempotencyKey,
    });
    await this.audit.append({
      tenantId: application.tenantId,
      actorPersonId: actor.userId,
      action: `admission.application.${eventType}`,
      entityType: "admission_application",
      entityId: application.id,
      resultStatus: nextStatus,
      correlationId,
      idempotencyKey,
      redactedMetadata: {
        previousStatus: previousStatus ?? null,
        nextStatus,
        programId: application.programId,
      },
    });
  }
}
