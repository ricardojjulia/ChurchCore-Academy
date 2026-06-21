export type { WorkflowQueueItem } from "./repository";
export type {
  WorkflowRecord,
  WorkflowStatus,
  WorkflowActionRecord,
  WorkflowActionType,
  WorkflowFeedbackRecord,
  WorkflowFeedbackType,
  QueueFilters,
} from "@/modules/shepherd-ai/types";

export interface WorkflowFeedbackInput {
  workflowId: string;
  userId: string;
  feedbackType: import("@/modules/shepherd-ai/types").WorkflowFeedbackType;
  notes?: string;
}
