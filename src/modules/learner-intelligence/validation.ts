import {
  LearnerActivityEventInput,
  LearnerActivityEventType,
  LearnerIntelligenceConsentInput,
  LearnerMemoryEntryInput,
  LearnerMemorySensitivity,
  LearnerMemoryType,
} from "@/modules/learner-intelligence/types";

const activityEventTypes = new Set<LearnerActivityEventType>([
  "lesson_start",
  "lesson_complete",
  "lesson_abandon",
  "quiz_attempt",
  "quiz_pass",
  "quiz_fail",
  "assignment_submit",
  "assignment_retry",
  "video_play",
  "video_pause",
  "video_scrub_back",
  "discussion_post",
  "discussion_reply",
  "ai_tutor_session_start",
  "ai_tutor_session_end",
  "session_start",
  "session_end",
  "energy_checkin",
]);

const memoryTypes = new Set<LearnerMemoryType>([
  "struggle_pattern",
  "strength_signal",
  "optimal_time_window",
  "content_format_preference",
  "social_learning_bond",
  "breakthrough_moment",
  "communication_style_signal",
  "motivation_pattern",
]);

const memorySensitivityLevels = new Set<LearnerMemorySensitivity>(["standard", "pastoral", "confidential"]);

const piiKeys = ["email", "phone", "ssn", "fullName", "name"];

function requireNonEmpty(value: string, field: string) {
  if (!value.trim()) {
    throw new Error(`${field} is required.`);
  }

  return value.trim();
}

function assertNoPiiMetadata(metadata: Record<string, unknown>) {
  const keyStack = Object.keys(metadata);
  while (keyStack.length > 0) {
    const key = keyStack.pop();
    if (!key) {
      continue;
    }

    const lowerKey = key.toLowerCase();
    if (piiKeys.some((entry) => lowerKey.includes(entry.toLowerCase()))) {
      throw new Error("metadata contains prohibited PII fields.");
    }

    const value = metadata[key];
    if (typeof value === "string" && value.includes("@")) {
      throw new Error("metadata must not include email-like values.");
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      keyStack.push(...Object.keys(value as Record<string, unknown>));
    }
  }
}

export function validateLearnerActivityEventInput(input: LearnerActivityEventInput): LearnerActivityEventInput {
  const tenantId = requireNonEmpty(input.tenantId, "tenantId");
  const learnerId = requireNonEmpty(input.learnerId, "learnerId");

  if (!activityEventTypes.has(input.eventType)) {
    throw new Error("eventType is invalid.");
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const parsed = new Date(occurredAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("occurredAt must be an ISO timestamp.");
  }

  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
  if (parsed.getTime() > fiveMinutesFromNow) {
    throw new Error("occurredAt cannot be in the future beyond 5 minutes.");
  }

  const metadata = input.metadata ?? {};
  const metadataSize = JSON.stringify(metadata).length;
  if (metadataSize > 6000) {
    throw new Error("metadata must be 6000 characters or fewer.");
  }

  assertNoPiiMetadata(metadata);

  return {
    ...input,
    tenantId,
    learnerId,
    occurredAt,
    metadata,
  };
}

export function validateLearnerIntelligenceConsentInput(
  input: LearnerIntelligenceConsentInput,
): LearnerIntelligenceConsentInput {
  const tenantId = requireNonEmpty(input.tenantId, "tenantId");
  const learnerId = requireNonEmpty(input.learnerId, "learnerId");
  const consentVersion = requireNonEmpty(input.consentVersion, "consentVersion");

  const consentedAt = input.consentedAt ?? new Date().toISOString();
  if (Number.isNaN(new Date(consentedAt).getTime())) {
    throw new Error("consentedAt must be an ISO timestamp.");
  }

  return {
    ...input,
    tenantId,
    learnerId,
    consentVersion,
    consentedAt,
  };
}

export function validateLearnerMemoryEntryInput(input: LearnerMemoryEntryInput): LearnerMemoryEntryInput {
  const tenantId = requireNonEmpty(input.tenantId, "tenantId");
  const learnerId = requireNonEmpty(input.learnerId, "learnerId");
  const content = requireNonEmpty(input.content, "content");

  if (!memoryTypes.has(input.memoryType)) {
    throw new Error("memoryType is invalid.");
  }

  if (input.initialConfidence < 0 || input.initialConfidence > 1) {
    throw new Error("initialConfidence must be between 0 and 1.");
  }

  const confidenceDecayRate = input.confidenceDecayRate ?? 0.02;
  if (confidenceDecayRate < 0 || confidenceDecayRate > 1) {
    throw new Error("confidenceDecayRate must be between 0 and 1.");
  }

  const sensitivityLevel = input.sensitivityLevel ?? "standard";
  if (!memorySensitivityLevels.has(sensitivityLevel)) {
    throw new Error("sensitivityLevel is invalid.");
  }

  const observedAt = input.observedAt ?? new Date().toISOString();
  if (Number.isNaN(new Date(observedAt).getTime())) {
    throw new Error("observedAt must be an ISO timestamp.");
  }

  return {
    ...input,
    tenantId,
    learnerId,
    content,
    confidenceDecayRate,
    sensitivityLevel,
    observedAt,
    sourceEventIds: input.sourceEventIds ?? [],
  };
}
