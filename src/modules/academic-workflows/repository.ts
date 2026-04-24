import {
  QueueFilters,
  ShepherdAiSuggestion,
  WorkflowActionRecord,
  WorkflowFeedbackRecord,
  WorkflowRecord,
} from "@/modules/shepherd-ai/types";

export interface WorkflowQueueItem {
  kind: "suggestion" | "workflow";
  id: string;
  workflowCode: ShepherdAiSuggestion["workflowCode"];
  title: string;
  summary: string;
  entityType: ShepherdAiSuggestion["entityType"];
  entityId: string;
  urgency: ShepherdAiSuggestion["urgency"];
  status: ShepherdAiSuggestion["status"] | WorkflowRecord["status"];
  assignee?: string;
  generatedAt: string;
  confidenceScore?: number;
}

function urgencyRank(value: WorkflowQueueItem["urgency"]) {
  return value === "high" ? 0 : value === "medium" ? 1 : 2;
}

export class InMemoryAcademicWorkflowRepository {
  constructor(
    public suggestions: ShepherdAiSuggestion[] = [],
    public workflows: WorkflowRecord[] = [],
    public workflowActions: WorkflowActionRecord[] = [],
    public workflowFeedback: WorkflowFeedbackRecord[] = [],
  ) {}

  seedSuggestions(suggestions: ShepherdAiSuggestion[]) {
    this.suggestions = [...suggestions];
  }

  updateSuggestion(suggestionId: string, updater: (suggestion: ShepherdAiSuggestion) => ShepherdAiSuggestion) {
    this.suggestions = this.suggestions.map((suggestion) => (suggestion.id === suggestionId ? updater(suggestion) : suggestion));
  }

  addWorkflow(workflow: WorkflowRecord) {
    this.workflows = [...this.workflows, workflow];
  }

  addAction(action: WorkflowActionRecord) {
    this.workflowActions = [...this.workflowActions, action];
  }

  addFeedback(feedback: WorkflowFeedbackRecord) {
    this.workflowFeedback = [...this.workflowFeedback, feedback];
  }

  getQueue(filters: QueueFilters = {}): WorkflowQueueItem[] {
    const items: WorkflowQueueItem[] = [
      ...this.suggestions.map((suggestion) => ({
        kind: "suggestion" as const,
        id: suggestion.id,
        workflowCode: suggestion.workflowCode,
        title: suggestion.title,
        summary: suggestion.summary,
        entityType: suggestion.entityType,
        entityId: suggestion.entityId,
        urgency: suggestion.urgency,
        status: suggestion.status,
        generatedAt: suggestion.generatedAt,
        confidenceScore: suggestion.confidenceScore,
      })),
      ...this.workflows.map((workflow) => {
        const source = this.suggestions.find((suggestion) => suggestion.id === workflow.suggestionId);
        return {
          kind: "workflow" as const,
          id: workflow.id,
          workflowCode: workflow.workflowCode,
          title: source?.title ?? workflow.workflowCode,
          summary: source?.summary ?? "Workflow promoted from a ShepherdAI Academy suggestion.",
          entityType: source?.entityType ?? "student",
          entityId: source?.entityId ?? workflow.id,
          urgency: source?.urgency ?? "medium",
          status: workflow.status,
          assignee: workflow.assignedToUserId,
          generatedAt: workflow.createdAt,
          confidenceScore: source?.confidenceScore,
        };
      }),
    ];

    return items
      .filter((item) => !filters.urgency || filters.urgency === "all" || item.urgency === filters.urgency)
      .filter((item) => !filters.status || filters.status === "all" || item.status === filters.status)
      .filter((item) => !filters.workflowCode || filters.workflowCode === "all" || item.workflowCode === filters.workflowCode)
      .filter((item) => !filters.assignee || filters.assignee === "all" || item.assignee === filters.assignee)
      .sort((left, right) => {
        if (left.status !== right.status) {
          const statusOrder = {
            suggested: 0,
            open: 1,
            assigned: 2,
            deferred: 3,
            completed: 4,
            promoted: 5,
            dismissed: 6,
          };
          return statusOrder[left.status] - statusOrder[right.status];
        }

        if (left.urgency !== right.urgency) {
          return urgencyRank(left.urgency) - urgencyRank(right.urgency);
        }

        return (right.confidenceScore ?? 0) - (left.confidenceScore ?? 0);
      });
  }
}
