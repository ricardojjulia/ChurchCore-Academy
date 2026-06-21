import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import {
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import type {
  TranscriptDeliveryMethod,
  TranscriptRecord,
  TranscriptRepository,
} from "@/modules/transcripts/types";
import { validateTranscriptRequest } from "@/modules/transcripts/types";

const transcriptAdminRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
]);

export function hasTranscriptAdminAccess(actor: AcademyActor) {
  return actor.roles.some((role) => transcriptAdminRoles.has(role));
}

export class TranscriptService {
  constructor(private readonly repository: TranscriptRepository) {}

  async requestTranscript(
    actor: AcademyActor,
    input: {
      studentPersonId: string;
      deliveryMethod: TranscriptDeliveryMethod;
      recipientName?: string;
      recipientEmail?: string;
      note?: string;
      idempotencyKey: string;
    },
  ): Promise<TranscriptRecord> {
    if (!hasTranscriptAdminAccess(actor) && input.studentPersonId !== actor.userId) {
      throw new AcademyAuthorizationError(
        "Students can request only their own transcripts.",
      );
    }

    return this.repository.createRequest(
      validateTranscriptRequest({
        tenantId: actor.tenantId,
        studentPersonId: input.studentPersonId,
        requestedByPersonId: actor.userId,
        deliveryMethod: input.deliveryMethod,
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        note: input.note,
        idempotencyKey: input.idempotencyKey,
      }),
    );
  }

  async issueTranscript(
    actor: AcademyActor,
    input: {
      studentPersonId: string;
      deliveryMethod: TranscriptDeliveryMethod;
      recipientName?: string;
      recipientEmail?: string;
      note?: string;
      idempotencyKey: string;
    },
  ): Promise<TranscriptRecord> {
    assertTranscriptAdmin(actor);

    const hasPostedRecords = await this.repository.hasPostedTranscriptRecords(
      actor.tenantId,
      input.studentPersonId,
    );
    if (!hasPostedRecords) {
      throw new AcademyConflictError(
        "Posted transcript records are required before transcript issuance.",
      );
    }

    const hasActiveHold = await this.repository.hasActiveTranscriptHold(
      actor.tenantId,
      input.studentPersonId,
    );
    if (hasActiveHold) {
      throw new AcademyConflictError(
        "Transcript hold must be released before issuance.",
      );
    }

    return this.repository.issue(
      validateTranscriptRequest({
        tenantId: actor.tenantId,
        studentPersonId: input.studentPersonId,
        requestedByPersonId: actor.userId,
        deliveryMethod: input.deliveryMethod,
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        note: input.note,
        idempotencyKey: input.idempotencyKey,
      }),
    );
  }

  async holdTranscript(
    actor: AcademyActor,
    transcriptId: string,
    reason: string,
  ) {
    assertTranscriptAdmin(actor);
    return this.repository.hold(actor.tenantId, transcriptId, actor.userId, reason);
  }

  async releaseTranscript(
    actor: AcademyActor,
    transcriptId: string,
    reason: string,
  ) {
    assertTranscriptAdmin(actor);
    return this.repository.release(actor.tenantId, transcriptId, actor.userId, reason);
  }

  async revokeTranscript(
    actor: AcademyActor,
    transcriptId: string,
    reason: string,
  ) {
    assertTranscriptAdmin(actor);
    return this.repository.revoke(actor.tenantId, transcriptId, actor.userId, reason);
  }
}

function assertTranscriptAdmin(actor: AcademyActor) {
  if (!hasTranscriptAdminAccess(actor)) {
    throw new AcademyAuthorizationError(
      "Forbidden transcript administration access.",
    );
  }
}
