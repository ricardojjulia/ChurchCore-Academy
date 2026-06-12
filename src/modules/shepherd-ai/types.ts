export type AcademyProductArea = "academy";

export type AcademicWorkflowType = "academic";

export type WorkflowCode =
  | "incomplete_enrollment_follow_up"
  | "missing_documentation_review"
  | "graduation_eligibility_review"
  | "academic_standing_or_credit_progress_review"
  | "transcript_or_records_inconsistency_review"
  | "faculty_or_course_assignment_imbalance_review"
  | "calendar_setup_review";

export type SignalType =
  | "enrollment_pending_beyond_threshold"
  | "required_document_missing"
  | "graduation_threshold_near"
  | "credit_progress_gap"
  | "transcript_inconsistency_possible"
  | "course_without_instructor"
  | "faculty_course_assignment_imbalance"
  | "calendar_setup_incomplete_or_inconsistent";

export type EntityType =
  | "student"
  | "application"
  | "enrollment"
  | "program"
  | "course"
  | "course_section"
  | "faculty"
  | "advisor"
  | "transcript"
  | "graduation_review"
  | "institution";
export type SignalCategory =
  | "enrollment-signals"
  | "student-record-signals"
  | "graduation-signals"
  | "transcript-signals"
  | "faculty-admin-signals"
  | "institutional-setup-signals";
export type Urgency = "low" | "medium" | "high" | "critical";
export type SuggestionStatus = "suggested" | "promoted_to_workflow" | "deferred" | "dismissed" | "resolved";
export type WorkflowStatus = "open" | "assigned" | "deferred" | "completed";
export type WorkflowActionType = "assign" | "defer" | "dismiss" | "complete" | "promote" | "note";
export type WorkflowFeedbackType = "accepted" | "needs_tuning" | "not_useful";

export interface AiSignalRecord {
  id: string;
  tenantId: string;
  productArea: AcademyProductArea;
  entityType: EntityType;
  entityId: string;
  signalType: SignalType;
  signalValue: number;
  signalWindow: string;
  signalPayloadJson: Record<string, unknown>;
  detectedAt: string;
}

export interface SuggestionExplanation {
  detected: string[];
  whySurfaced: string[];
  sourceSignalCategories: SignalCategory[];
  limitations: string[];
}

export interface ShepherdAiSuggestedAction {
  actionType: string;
  label: string;
  description: string;
  requiresHumanReview: boolean;
}

export interface ShepherdAiSuggestion {
  id: string;
  tenantId: string;
  productArea: AcademyProductArea;
  workflowType: AcademicWorkflowType;
  workflowCode: WorkflowCode;
  entityType: EntityType;
  entityId: string;
  title: string;
  summary: string;
  confidenceScore: number;
  urgency: Urgency;
  suggestedActions: ShepherdAiSuggestedAction[];
  explanation: SuggestionExplanation;
  boundaryNote: string;
  generatedAt: string;
  status: SuggestionStatus;
  messageDraft?: string;
}

export interface WorkflowRecord {
  id: string;
  tenantId: string;
  suggestionId?: string;
  workflowType: AcademicWorkflowType;
  workflowCode: WorkflowCode;
  ownerUserId: string;
  assignedToUserId?: string;
  status: WorkflowStatus;
  dueAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface WorkflowActionRecord {
  id: string;
  workflowId: string;
  actionType: WorkflowActionType;
  actionPayloadJson: Record<string, unknown>;
  status: "logged";
  createdAt: string;
}

export interface WorkflowFeedbackRecord {
  id: string;
  workflowId: string;
  userId: string;
  feedbackType: WorkflowFeedbackType;
  notes?: string;
  createdAt: string;
}

export interface ShepherdAiEvaluationInput {
  tenantId: string;
  productArea: AcademyProductArea;
  entityType?: EntityType;
  entityId?: string;
  signals: AiSignalRecord[];
  context: Record<string, unknown>;
}

export interface QueueFilters {
  urgency?: Urgency | "all";
  status?: SuggestionStatus | WorkflowStatus | "all";
  workflowCode?: WorkflowCode | "all";
  assignee?: string | "all";
}
