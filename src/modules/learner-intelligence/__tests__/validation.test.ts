import assert from "node:assert/strict";
import test from "node:test";
import {
  validateLearnerActivityEventInput,
  validateLearnerIntelligenceConsentInput,
  validateLearnerMemoryEntryInput,
} from "@/modules/learner-intelligence/validation";

test("validates learner activity events with bounded metadata", () => {
  const parsed = validateLearnerActivityEventInput({
    tenantId: "tenant-1",
    learnerId: "student-1",
    eventType: "lesson_complete",
    metadata: {
      sessionDurationSeconds: 1240,
      retryCount: 1,
    },
  });

  assert.equal(parsed.tenantId, "tenant-1");
  assert.equal(parsed.learnerId, "student-1");
  assert.equal(parsed.eventType, "lesson_complete");
});

test("rejects activity events containing prohibited metadata PII keys", () => {
  assert.throws(
    () =>
      validateLearnerActivityEventInput({
        tenantId: "tenant-1",
        learnerId: "student-1",
        eventType: "session_start",
        metadata: {
          email: "student@example.org",
        },
      }),
    /metadata contains prohibited PII fields\./,
  );
});

test("rejects activity events with future timestamps beyond tolerance", () => {
  const tooFuture = new Date(Date.now() + 8 * 60 * 1000).toISOString();

  assert.throws(
    () =>
      validateLearnerActivityEventInput({
        tenantId: "tenant-1",
        learnerId: "student-1",
        eventType: "session_start",
        occurredAt: tooFuture,
      }),
    /occurredAt cannot be in the future beyond 5 minutes\./,
  );
});

test("validates consent updates and applies default consentedAt", () => {
  const parsed = validateLearnerIntelligenceConsentInput({
    tenantId: "tenant-1",
    learnerId: "student-1",
    consentVersion: "2026-06",
    consentBehavioralTracking: true,
    consentAiMemory: true,
    consentSocialGraph: false,
    consentPredictiveModeling: false,
    consentLearnerMirror: true,
  });

  assert.equal(parsed.consentVersion, "2026-06");
  assert.ok(parsed.consentedAt);
});

test("validates memory entries with defaults", () => {
  const parsed = validateLearnerMemoryEntryInput({
    tenantId: "tenant-1",
    learnerId: "student-1",
    memoryType: "strength_signal",
    content: "Learner shows strong persistence during long-form quizzes.",
    initialConfidence: 0.8,
  });

  assert.equal(parsed.sensitivityLevel, "standard");
  assert.equal(parsed.confidenceDecayRate, 0.02);
  assert.deepEqual(parsed.sourceEventIds, []);
});

test("rejects memory entries with invalid confidence bounds", () => {
  assert.throws(
    () =>
      validateLearnerMemoryEntryInput({
        tenantId: "tenant-1",
        learnerId: "student-1",
        memoryType: "struggle_pattern",
        content: "Learner disengages after retries exceed 2.",
        initialConfidence: 1.4,
      }),
    /initialConfidence must be between 0 and 1\./,
  );
});
