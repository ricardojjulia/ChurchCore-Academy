export type LearnerActivityEventType =
  | "lesson_start"
  | "lesson_complete"
  | "lesson_abandon"
  | "quiz_attempt"
  | "quiz_pass"
  | "quiz_fail"
  | "assignment_submit"
  | "assignment_retry"
  | "video_play"
  | "video_pause"
  | "video_scrub_back"
  | "discussion_post"
  | "discussion_reply"
  | "ai_tutor_session_start"
  | "ai_tutor_session_end"
  | "session_start"
  | "session_end"
  | "energy_checkin";

export type LearnerMemoryType =
  | "struggle_pattern"
  | "strength_signal"
  | "optimal_time_window"
  | "content_format_preference"
  | "social_learning_bond"
  | "breakthrough_moment"
  | "communication_style_signal"
  | "motivation_pattern";

export type LearnerMemorySensitivity = "standard" | "pastoral" | "confidential";

export interface LearnerActivityEventInput {
  tenantId: string;
  learnerId: string;
  eventType: LearnerActivityEventType;
  metadata?: Record<string, unknown>;
  courseId?: string;
  sectionId?: string;
  moduleId?: string;
  occurredAt?: string;
}

export interface LearnerIntelligenceConsentInput {
  tenantId: string;
  learnerId: string;
  consentVersion: string;
  consentBehavioralTracking: boolean;
  consentAiMemory: boolean;
  consentSocialGraph: boolean;
  consentPredictiveModeling: boolean;
  consentLearnerMirror: boolean;
  consentedAt?: string;
}

export interface LearnerIntelligenceConsentRecord {
  id?: string;
  tenantId: string;
  learnerId: string;
  consentBehavioralTracking: boolean;
  consentAiMemory: boolean;
  consentSocialGraph: boolean;
  consentPredictiveModeling: boolean;
  consentLearnerMirror: boolean;
  consentVersion: string;
  consentedAt: string;
  revokedAt?: string;
  revocationReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LearnerConsentRevocationInput {
  tenantId: string;
  learnerId: string;
  consentVersion: string;
  reason: string;
}

export interface LearnerMemoryEntryInput {
  tenantId: string;
  learnerId: string;
  courseId?: string;
  memoryType: LearnerMemoryType;
  sensitivityLevel?: LearnerMemorySensitivity;
  content: string;
  initialConfidence: number;
  confidenceDecayRate?: number;
  generationModel?: string;
  sourceEventIds?: string[];
  observedAt?: string;
}

export interface LearnerMemoryEntryRecord {
  id: string;
  tenantId: string;
  learnerId: string;
  courseId?: string;
  memoryType: LearnerMemoryType;
  sensitivityLevel: LearnerMemorySensitivity;
  content: string;
  initialConfidence: number;
  confidenceDecayRate: number;
  humanReviewed: boolean;
  observedAt: string;
  createdAt: string;
}

export type LearnerInterventionStatus = "pending" | "reviewed" | "acted_on" | "dismissed" | "expired";

export interface LearnerInterventionRecord {
  id: string;
  tenantId: string;
  learnerId: string;
  courseId?: string;
  riskScore: number;
  riskType: "dark_period" | "low_momentum" | "concept_struggle" | "social_isolation";
  status: LearnerInterventionStatus;
  riskHorizon?: string;
  createdAt: string;
  expiresAt: string;
}

export interface LearnerInterventionQueryOptions {
  learnerId?: string;
  status?: LearnerInterventionStatus;
  limit: number;
}

export interface LearnerInterventionStatusUpdateInput {
  status: LearnerInterventionStatus;
  instructorNotes?: string;
  expectedCurrentStatus?: LearnerInterventionStatus;
}

export interface LearnerInterventionStatusHistoryRecord {
  id: string;
  tenantId: string;
  interventionId: string;
  previousStatus: LearnerInterventionStatus;
  nextStatus: LearnerInterventionStatus;
  changedByUserId?: string;
  note?: string;
  changedAt: string;
}

export interface LearnerIntelligenceRepository {
  recordActivityEvent(event: LearnerActivityEventInput): Promise<void>;
  upsertConsent(consent: LearnerIntelligenceConsentInput): Promise<void>;
  insertMemoryEntry(entry: LearnerMemoryEntryInput): Promise<void>;
  fetchLatestConsent(tenantId: string, learnerId: string): Promise<LearnerIntelligenceConsentRecord | null>;
  listConsentHistory(
    tenantId: string,
    learnerId: string,
    limit: number,
  ): Promise<LearnerIntelligenceConsentRecord[]>;
  revokeConsent(input: LearnerConsentRevocationInput): Promise<LearnerIntelligenceConsentRecord>;
  listMemoryEntries(tenantId: string, learnerId: string, limit: number): Promise<LearnerMemoryEntryRecord[]>;
  listInterventions(tenantId: string, options: LearnerInterventionQueryOptions): Promise<LearnerInterventionRecord[]>;
  updateInterventionStatus(
    tenantId: string,
    interventionId: string,
    input: LearnerInterventionStatusUpdateInput,
    changedByUserId?: string,
  ): Promise<LearnerInterventionRecord>;
  listInterventionStatusHistory(
    tenantId: string,
    interventionId: string,
    limit: number,
  ): Promise<LearnerInterventionStatusHistoryRecord[]>;
}
