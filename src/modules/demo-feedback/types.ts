export const demoFeedbackCategories = ["BUG", "ERROR", "UNEXPECTED_RESULT", "IMPROVEMENT"] as const;

export type DemoFeedbackCategory = (typeof demoFeedbackCategories)[number];

export const demoFeedbackActions = [
  "code_fixed",
  "update_applied",
  "suggestion_not_implemented",
  "suggestion_implemented",
  "bug_fixed",
  "error_fixed",
  "received_and_closed",
] as const;

export type DemoFeedbackAction = (typeof demoFeedbackActions)[number];

export interface DemoFeedbackSubmissionInput {
  sessionId: string;
  route: string;
  category: DemoFeedbackCategory;
  errorMessage?: string;
  note?: string;
  breadcrumbs: string[];
  demoVersion: string;
  sessionDurationSeconds: number;
}

export interface DemoFeedbackSubmission {
  sessionId: string;
  route: string;
  category: DemoFeedbackCategory;
  errorMessage: string | null;
  note: string | null;
  breadcrumbs: string[];
  demoVersion: string;
  sessionDurationSeconds: number;
}

export interface DemoFeedbackStoredRecord {
  id: string;
  fingerprint: string;
  sessionId: string;
  route: string;
  category: DemoFeedbackCategory;
  errorMessage: string | null;
  note: string | null;
  breadcrumbs: string[];
  userEmail: string | null;
  userRole: string | null;
  demoVersion: string;
  sessionDurationSeconds: number | null;
  hitCount: number;
  metadata: Record<string, unknown>;
  processed: boolean;
  action: DemoFeedbackAction | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoFeedbackIdentity {
  userEmail: string | null;
  userRole: string | null;
}

export interface DemoFeedbackTriageFilters {
  status?: "open" | "done" | "all";
  category?: DemoFeedbackCategory;
  identity?: string;
  from?: string;
  to?: string;
}

export interface DemoFeedbackTriageUpdate {
  processed?: boolean;
  action?: DemoFeedbackAction | null;
}
