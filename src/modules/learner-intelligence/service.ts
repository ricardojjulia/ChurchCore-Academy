import { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import {
  assertConsentForActivityEvent,
  assertConsentForMemoryWrite,
} from "@/modules/learner-intelligence/consent-guard";
import {
  LearnerActivityEventInput,
  LearnerInterventionQueryOptions,
  LearnerInterventionRecord,
  LearnerInterventionStatusHistoryRecord,
  LearnerInterventionStatusUpdateInput,
  LearnerIntelligenceConsentInput,
  LearnerIntelligenceRepository,
  LearnerMemoryEntryRecord,
  LearnerMemoryEntryInput,
} from "@/modules/learner-intelligence/types";
import {
  validateLearnerActivityEventInput,
  validateLearnerIntelligenceConsentInput,
  validateLearnerMemoryEntryInput,
} from "@/modules/learner-intelligence/validation";

const staffRoles: ReadonlySet<AcademyRole> = new Set([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "advisor",
  "faculty",
  "teacher",
  "professor",
]);

const memoryWriteRoles: ReadonlySet<AcademyRole> = new Set([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
]);

const allowedInterventionTransitions: Record<string, ReadonlySet<string>> = {
  pending: new Set(["pending", "reviewed", "acted_on", "dismissed", "expired"]),
  reviewed: new Set(["reviewed", "acted_on", "dismissed", "expired"]),
  acted_on: new Set(["acted_on"]),
  dismissed: new Set(["dismissed"]),
  expired: new Set(["expired"]),
};

export class LearnerIntelligenceService {
  constructor(private readonly repository: LearnerIntelligenceRepository) {}

  async recordActivityEvent(actor: AcademyActor, input: LearnerActivityEventInput) {
    this.assertSameTenant(actor, input.tenantId, "Forbidden learner intelligence event write.");

    const canRecordForLearner = actor.userId === input.learnerId;
    const canRecordAsStaff = actor.roles.some((role) => staffRoles.has(role));
    if (!canRecordForLearner && !canRecordAsStaff) {
      throw new Error("Forbidden learner intelligence event write.");
    }

    const validated = validateLearnerActivityEventInput(input);
    const consent = await this.repository.fetchLatestConsent(validated.tenantId, validated.learnerId);
    assertConsentForActivityEvent(consent, validated.eventType);
    await this.repository.recordActivityEvent(validated);
  }

  async upsertConsent(actor: AcademyActor, input: LearnerIntelligenceConsentInput) {
    this.assertSameTenant(actor, input.tenantId, "Forbidden learner intelligence consent write.");

    const canManageOwnConsent = actor.userId === input.learnerId;
    if (!canManageOwnConsent) {
      throw new Error("Forbidden learner intelligence consent write.");
    }

    const validated = validateLearnerIntelligenceConsentInput(input);
    await this.repository.upsertConsent(validated);
  }

  async writeMemoryEntry(actor: AcademyActor, input: LearnerMemoryEntryInput) {
    this.assertSameTenant(actor, input.tenantId, "Forbidden learner intelligence memory write.");

    const hasMemoryWriteRole = actor.roles.some((role) => memoryWriteRoles.has(role));
    if (!hasMemoryWriteRole) {
      throw new Error("Forbidden learner intelligence memory write.");
    }

    const validated = validateLearnerMemoryEntryInput(input);
    const consent = await this.repository.fetchLatestConsent(validated.tenantId, validated.learnerId);
    assertConsentForMemoryWrite(consent);
    await this.repository.insertMemoryEntry(validated);
  }

  async listMemoryEntries(actor: AcademyActor, tenantId: string, learnerId: string, limit = 25): Promise<LearnerMemoryEntryRecord[]> {
    this.assertSameTenant(actor, tenantId, "Forbidden learner intelligence read.");

    const canReadAsStaff = actor.roles.some((role) => staffRoles.has(role));
    if (!canReadAsStaff) {
      throw new Error("Forbidden learner intelligence read.");
    }

    const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    return this.repository.listMemoryEntries(tenantId, learnerId, boundedLimit);
  }

  async listInterventions(
    actor: AcademyActor,
    tenantId: string,
    options: Omit<LearnerInterventionQueryOptions, "limit"> & { limit?: number },
  ): Promise<LearnerInterventionRecord[]> {
    this.assertSameTenant(actor, tenantId, "Forbidden learner intelligence read.");

    const canReadAsStaff = actor.roles.some((role) => staffRoles.has(role));
    if (!canReadAsStaff) {
      throw new Error("Forbidden learner intelligence read.");
    }

    const boundedLimit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 25)));
    return this.repository.listInterventions(tenantId, {
      learnerId: options.learnerId,
      status: options.status,
      limit: boundedLimit,
    });
  }

  async updateInterventionStatus(
    actor: AcademyActor,
    tenantId: string,
    interventionId: string,
    input: LearnerInterventionStatusUpdateInput,
  ) {
    this.assertSameTenant(actor, tenantId, "Forbidden learner intelligence write.");

    const canWriteAsStaff = actor.roles.some((role) => staffRoles.has(role));
    if (!canWriteAsStaff) {
      throw new Error("Forbidden learner intelligence write.");
    }

    if (!interventionId.trim()) {
      throw new Error("interventionId is required.");
    }

    if (typeof input.instructorNotes === "string" && input.instructorNotes.length > 2000) {
      throw new Error("instructorNotes must be 2000 characters or fewer.");
    }

    if (!input.expectedCurrentStatus) {
      throw new Error("expectedCurrentStatus is required.");
    }

    if (!["pending", "reviewed", "acted_on", "dismissed", "expired"].includes(input.expectedCurrentStatus)) {
      throw new Error("expectedCurrentStatus is invalid.");
    }

    const allowedNextStatuses = allowedInterventionTransitions[input.expectedCurrentStatus];
    if (!allowedNextStatuses.has(input.status)) {
      throw new Error(`Invalid status transition from ${input.expectedCurrentStatus} to ${input.status}.`);
    }

    return this.repository.updateInterventionStatus(tenantId, interventionId, {
      status: input.status,
      instructorNotes: input.instructorNotes?.trim() || undefined,
      expectedCurrentStatus: input.expectedCurrentStatus,
    }, actor.userId);
  }

  async listInterventionStatusHistory(
    actor: AcademyActor,
    tenantId: string,
    interventionId: string,
    limit = 25,
  ): Promise<LearnerInterventionStatusHistoryRecord[]> {
    this.assertSameTenant(actor, tenantId, "Forbidden learner intelligence read.");

    const canReadAsStaff = actor.roles.some((role) => staffRoles.has(role));
    if (!canReadAsStaff) {
      throw new Error("Forbidden learner intelligence read.");
    }

    if (!interventionId.trim()) {
      throw new Error("interventionId is required.");
    }

    const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    return this.repository.listInterventionStatusHistory(tenantId, interventionId, boundedLimit);
  }

  private assertSameTenant(actor: AcademyActor, tenantId: string, errorMessage: string) {
    if (actor.tenantId !== tenantId) {
      throw new Error(errorMessage);
    }
  }
}
