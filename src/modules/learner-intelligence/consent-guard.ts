import {
  LearnerActivityEventType,
  LearnerIntelligenceConsentRecord,
} from "@/modules/learner-intelligence/types";

export function assertConsentForActivityEvent(
  consent: LearnerIntelligenceConsentRecord | null,
  eventType: LearnerActivityEventType,
) {
  if (!consent || consent.revokedAt) {
    throw new Error(`Consent required for learner activity event: ${eventType}.`);
  }

  if (!consent.consentBehavioralTracking) {
    throw new Error(`Consent required for learner activity event: ${eventType}.`);
  }
}

export function assertConsentForMemoryWrite(consent: LearnerIntelligenceConsentRecord | null) {
  if (!consent || consent.revokedAt) {
    throw new Error("Consent required for learner memory write.");
  }

  if (!consent.consentAiMemory) {
    throw new Error("Consent required for learner memory write.");
  }
}
