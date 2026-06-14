import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { LearnerIntelligenceService } from "@/modules/learner-intelligence/service";
import { LearnerIntelligenceConsentRecord, LearnerIntelligenceRepository } from "@/modules/learner-intelligence/types";

function createRepositorySpy() {
  const calls = {
    events: 0,
    consent: 0,
    memory: 0,
    listMemory: 0,
    listInterventions: 0,
    listHistory: 0,
    consentReads: 0,
    consentHistory: 0,
    consentRevocations: 0,
  };

  let latestConsent: LearnerIntelligenceConsentRecord | null = {
    id: "consent-1",
    tenantId: "tenant-1",
    learnerId: "student-2",
    consentBehavioralTracking: true,
    consentAiMemory: true,
    consentSocialGraph: false,
    consentPredictiveModeling: false,
    consentLearnerMirror: false,
    consentVersion: "2026-06",
    consentedAt: "2026-06-14T00:00:00.000Z",
  };

  const repository: LearnerIntelligenceRepository = {
    async recordActivityEvent() {
      calls.events += 1;
    },
    async upsertConsent(input) {
      calls.consent += 1;
      void input;
    },
    async insertMemoryEntry() {
      calls.memory += 1;
    },
    async fetchLatestConsent() {
      calls.consentReads += 1;
      return latestConsent;
    },
    async listConsentHistory() {
      calls.consentHistory += 1;
      return latestConsent ? [latestConsent] : [];
    },
    async revokeConsent() {
      calls.consentRevocations += 1;
      return {
        ...latestConsent!,
        revokedAt: "2026-06-14T15:00:00.000Z",
        revocationReason: "I no longer want this processing.",
      };
    },
    async listMemoryEntries() {
      calls.listMemory += 1;
      return [];
    },
    async listInterventions() {
      calls.listInterventions += 1;
      return [];
    },
    async updateInterventionStatus() {
      return {
        id: "int-1",
        tenantId: "tenant-1",
        learnerId: "student-2",
        riskScore: 0.71,
        riskType: "low_momentum",
        status: "reviewed",
        createdAt: "2026-06-14T00:00:00.000Z",
        expiresAt: "2026-07-01T00:00:00.000Z",
      };
    },
    async listInterventionStatusHistory() {
      calls.listHistory += 1;
      return [];
    },
  };

  return {
    repository,
    calls,
    setLatestConsent(value: LearnerIntelligenceConsentRecord | null) {
      latestConsent = value;
    },
  };
}

const academicAdminActor: AcademyActor = {
  userId: "staff-1",
  tenantId: "tenant-1",
  roles: ["academic_admin"],
};

const studentActor: AcademyActor = {
  userId: "student-1",
  tenantId: "tenant-1",
  roles: ["student"],
};

test("records activity events for same-tenant staff actors", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await service.recordActivityEvent(academicAdminActor, {
    tenantId: "tenant-1",
    learnerId: "student-2",
    eventType: "lesson_start",
    metadata: {
      localHourOfDay: 18,
    },
  });

  assert.equal(calls.events, 1);
});

test("rejects cross-tenant activity writes before repository access", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.recordActivityEvent(academicAdminActor, {
        tenantId: "other-tenant",
        learnerId: "student-2",
        eventType: "lesson_start",
      }),
    /Forbidden learner intelligence event write\./,
  );

  assert.equal(calls.events, 0);
});

test("allows learners to manage their own consent", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await service.upsertConsent(studentActor, {
    tenantId: "tenant-1",
    learnerId: "student-1",
    consentVersion: "2026-06",
    consentBehavioralTracking: true,
    consentAiMemory: true,
    consentSocialGraph: false,
    consentPredictiveModeling: false,
    consentLearnerMirror: true,
  });

  assert.equal(calls.consent, 1);
});

test("rejects consent changes for different learners without staff role", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.upsertConsent(studentActor, {
        tenantId: "tenant-1",
        learnerId: "student-2",
        consentVersion: "2026-06",
        consentBehavioralTracking: true,
        consentAiMemory: false,
        consentSocialGraph: false,
        consentPredictiveModeling: false,
        consentLearnerMirror: false,
      }),
    /Forbidden learner intelligence consent write\./,
  );

  assert.equal(calls.consent, 0);
});

test("rejects staff attempts to grant or change learner consent", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.upsertConsent(academicAdminActor, {
        tenantId: "tenant-1",
        learnerId: "student-2",
        consentVersion: "2026-06",
        consentBehavioralTracking: true,
        consentAiMemory: true,
        consentSocialGraph: false,
        consentPredictiveModeling: true,
        consentLearnerMirror: true,
      }),
    /Forbidden learner intelligence consent write\./,
  );

  assert.equal(calls.consent, 0);
});

test("allows learners to read their current consent and version history", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  const current = await service.getConsent(studentActor, "tenant-1", "student-1");
  const history = await service.listConsentHistory(studentActor, "tenant-1", "student-1", 10);

  assert.equal(current?.consentVersion, "2026-06");
  assert.equal(history.length, 1);
  assert.equal(calls.consentReads, 1);
  assert.equal(calls.consentHistory, 1);
});

test("rejects learners reading another learner consent history", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () => service.listConsentHistory(studentActor, "tenant-1", "student-2", 10),
    /Forbidden learner intelligence consent read\./,
  );

  assert.equal(calls.consentHistory, 0);
});

test("allows authorized staff to read learner consent without changing it", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await service.getConsent(academicAdminActor, "tenant-1", "student-2");

  assert.equal(calls.consentReads, 1);
  assert.equal(calls.consent, 0);
});

test("allows learners to revoke their current consent", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  const revoked = await service.revokeConsent(studentActor, {
    tenantId: "tenant-1",
    learnerId: "student-1",
    consentVersion: "2026-06",
    reason: "I no longer want this processing.",
  });

  assert.ok(revoked.revokedAt);
  assert.equal(calls.consentRevocations, 1);
});

test("rejects staff attempts to revoke learner consent", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.revokeConsent(academicAdminActor, {
        tenantId: "tenant-1",
        learnerId: "student-2",
        consentVersion: "2026-06",
        reason: "Administrative request.",
      }),
    /Forbidden learner intelligence consent write\./,
  );

  assert.equal(calls.consentRevocations, 0);
});

test("rejects consent revocation without a meaningful reason", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.revokeConsent(studentActor, {
        tenantId: "tenant-1",
        learnerId: "student-1",
        consentVersion: "2026-06",
        reason: " ",
      }),
    /reason is required\./,
  );

  assert.equal(calls.consentRevocations, 0);
});

test("allows memory writes only for approved staff roles", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await service.writeMemoryEntry(academicAdminActor, {
    tenantId: "tenant-1",
    learnerId: "student-2",
    memoryType: "strength_signal",
    content: "Learner sustains focus during project checkpoints.",
    initialConfidence: 0.7,
  });

  assert.equal(calls.memory, 1);
});

test("rejects memory writes for non-privileged roles", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.writeMemoryEntry(studentActor, {
        tenantId: "tenant-1",
        learnerId: "student-1",
        memoryType: "strength_signal",
        content: "Learner self-reflection entry.",
        initialConfidence: 0.6,
      }),
    /Forbidden learner intelligence memory write\./,
  );

  assert.equal(calls.memory, 0);
});

test("rejects activity events when behavioral consent is missing", async () => {
  const { repository, calls, setLatestConsent } = createRepositorySpy();
  setLatestConsent(null);
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.recordActivityEvent(academicAdminActor, {
        tenantId: "tenant-1",
        learnerId: "student-2",
        eventType: "lesson_start",
      }),
    /Consent required for learner activity event: lesson_start\./,
  );

  assert.equal(calls.events, 0);
});

test("rejects memory writes when AI memory consent is missing", async () => {
  const { repository, calls, setLatestConsent } = createRepositorySpy();
  setLatestConsent({
    tenantId: "tenant-1",
    learnerId: "student-2",
    consentBehavioralTracking: true,
    consentAiMemory: false,
    consentSocialGraph: false,
    consentPredictiveModeling: false,
    consentLearnerMirror: false,
    consentVersion: "2026-06",
    consentedAt: "2026-06-14T00:00:00.000Z",
  });
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.writeMemoryEntry(academicAdminActor, {
        tenantId: "tenant-1",
        learnerId: "student-2",
        memoryType: "strength_signal",
        content: "Learner demonstrates strong retention in review sessions.",
        initialConfidence: 0.8,
      }),
    /Consent required for learner memory write\./,
  );

  assert.equal(calls.memory, 0);
});

test("allows staff-only learner memory reads in same tenant", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await service.listMemoryEntries(academicAdminActor, "tenant-1", "student-2", 10);

  assert.equal(calls.listMemory, 1);
});

test("rejects learner memory reads for non-staff roles", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () => service.listMemoryEntries(studentActor, "tenant-1", "student-1", 10),
    /Forbidden learner intelligence read\./,
  );

  assert.equal(calls.listMemory, 0);
});

test("allows staff-only intervention reads in same tenant", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await service.listInterventions(academicAdminActor, "tenant-1", { status: "pending", limit: 10 });

  assert.equal(calls.listInterventions, 1);
});

test("rejects intervention reads for non-staff roles", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () => service.listInterventions(studentActor, "tenant-1", { limit: 10 }),
    /Forbidden learner intelligence read\./,
  );

  assert.equal(calls.listInterventions, 0);
});

test("allows staff to update intervention status", async () => {
  const { repository } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  const intervention = await service.updateInterventionStatus(academicAdminActor, "tenant-1", "int-1", {
    status: "reviewed",
    instructorNotes: "Reviewed and queued outreach.",
    expectedCurrentStatus: "pending",
  });

  assert.equal(intervention.id, "int-1");
  assert.equal(intervention.status, "reviewed");
});

test("rejects intervention status updates for non-staff roles", async () => {
  const { repository } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.updateInterventionStatus(studentActor, "tenant-1", "int-1", {
        status: "reviewed",
      }),
    /Forbidden learner intelligence write\./,
  );
});

test("rejects intervention status updates with oversized notes", async () => {
  const { repository } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.updateInterventionStatus(academicAdminActor, "tenant-1", "int-1", {
        status: "reviewed",
        instructorNotes: "x".repeat(2001),
      }),
    /instructorNotes must be 2000 characters or fewer\./,
  );
});

test("rejects intervention status updates with invalid expected status", async () => {
  const { repository } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.updateInterventionStatus(academicAdminActor, "tenant-1", "int-1", {
        status: "reviewed",
        expectedCurrentStatus: "invalid" as never,
      }),
    /expectedCurrentStatus is invalid\./,
  );
});

test("rejects intervention status updates when expectedCurrentStatus is missing", async () => {
  const { repository } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.updateInterventionStatus(academicAdminActor, "tenant-1", "int-1", {
        status: "reviewed",
      }),
    /expectedCurrentStatus is required\./,
  );
});

test("rejects invalid intervention status transitions", async () => {
  const { repository } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () =>
      service.updateInterventionStatus(academicAdminActor, "tenant-1", "int-1", {
        status: "pending",
        expectedCurrentStatus: "dismissed",
      }),
    /Invalid status transition from dismissed to pending\./,
  );
});

test("allows staff to read intervention status history", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await service.listInterventionStatusHistory(academicAdminActor, "tenant-1", "int-1", 10);

  assert.equal(calls.listHistory, 1);
});

test("rejects intervention status history reads for non-staff roles", async () => {
  const { repository, calls } = createRepositorySpy();
  const service = new LearnerIntelligenceService(repository);

  await assert.rejects(
    () => service.listInterventionStatusHistory(studentActor, "tenant-1", "int-1", 10),
    /Forbidden learner intelligence read\./,
  );

  assert.equal(calls.listHistory, 0);
});
