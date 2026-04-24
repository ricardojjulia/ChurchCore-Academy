export type WorkflowCode =
  | "incomplete-enrollment-follow-up"
  | "missing-student-documentation-review"
  | "graduation-eligibility-review"
  | "academic-progress-review"
  | "transcript-records-inconsistency-review"
  | "faculty-course-assignment-imbalance-review";

export type SignalType =
  | "incomplete_enrollment"
  | "missing_student_documentation"
  | "graduation_eligibility"
  | "academic_progress_gap"
  | "transcript_records_inconsistency"
  | "faculty_course_assignment_imbalance";

export type EntityType = "student" | "program" | "faculty" | "section";
export type SignalCategory =
  | "enrollment-signals"
  | "student-record-signals"
  | "graduation-signals"
  | "transcript-signals"
  | "faculty-admin-signals";
export type Urgency = "low" | "medium" | "high";
export type SuggestionStatus = "suggested" | "promoted" | "deferred" | "dismissed";
export type WorkflowStatus = "open" | "assigned" | "deferred" | "completed";
export type WorkflowActionType = "assign" | "defer" | "dismiss" | "complete" | "promote" | "note";
export type WorkflowFeedbackType = "accepted" | "needs_tuning" | "not_useful";

export interface AiSignalRecord {
  id: string;
  tenantId: string;
  entityType: EntityType;
  entityId: string;
  signalType: SignalType;
  signalValue: number;
  signalWindow: string;
  signalPayloadJson: Record<string, unknown>;
  detectedAt: string;
}

export interface SuggestionExplanation {
  whatDetected: string;
  whyItSurfaced: string;
  confidenceRationale: string;
  urgencyRationale: string;
  sourceSignalCategories: SignalCategory[];
}

export interface ShepherdAiSuggestion {
  id: string;
  tenantId: string;
  productArea: "academy";
  workflowType: "academic";
  workflowCode: WorkflowCode;
  entityType: EntityType;
  entityId: string;
  title: string;
  summary: string;
  confidenceScore: number;
  urgency: Urgency;
  suggestedActions: string[];
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
  workflowType: "academic";
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
  productArea: "academy";
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
