import { AcademyDataset } from "@/modules/academy-data/types";
import { InMemoryAcademicWorkflowRepository } from "@/modules/academic-workflows/repository";
import {
  QueueFilters,
  ShepherdAiSuggestion,
  WorkflowActionRecord,
  WorkflowFeedbackRecord,
  WorkflowFeedbackType,
  WorkflowRecord,
} from "@/modules/shepherd-ai/types";

interface PromoteInput {
  suggestionId: string;
  ownerUserId: string;
  assignedToUserId?: string;
  dueAt?: string;
}

export class AcademicWorkflowsService {
  constructor(
    private readonly dataset: AcademyDataset,
    private readonly repository: InMemoryAcademicWorkflowRepository,
  ) {}

  createWorkflow(input: PromoteInput) {
    const suggestion = this.requireSuggestion(input.suggestionId);
    const workflow: WorkflowRecord = {
      id: `workflow-${suggestion.id}`,
      tenantId: this.dataset.tenantId,
      suggestionId: suggestion.id,
      workflowType: "academic",
      workflowCode: suggestion.workflowCode,
      ownerUserId: input.ownerUserId,
      assignedToUserId: input.assignedToUserId,
      status: input.assignedToUserId ? "assigned" : "open",
      dueAt: input.dueAt,
      createdAt: this.dataset.generatedAt,
    };

    this.repository.updateSuggestion(input.suggestionId, (item) => ({ ...item, status: "promoted_to_workflow" }));
    this.repository.addWorkflow(workflow);
    this.logWorkflowEvent(workflow.id, "promote", { suggestionId: suggestion.id });

    return workflow;
  }

  assignWorkflow(workflowId: string, assignedToUserId: string) {
    this.updateWorkflow(workflowId, (workflow) => ({
      ...workflow,
      assignedToUserId,
      status: "assigned",
    }));
    this.logWorkflowEvent(workflowId, "assign", { assignedToUserId });
  }

  deferWorkflow(workflowId: string, reason: string) {
    this.updateWorkflow(workflowId, (workflow) => ({ ...workflow, status: "deferred" }));
    this.logWorkflowEvent(workflowId, "defer", { reason });
  }

  dismissSuggestion(suggestionId: string, note: string) {
    this.repository.updateSuggestion(suggestionId, (suggestion) => ({ ...suggestion, status: "dismissed" }));
    this.logWorkflowEvent(`dismiss-${suggestionId}`, "dismiss", { suggestionId, note });
  }

  completeWorkflow(workflowId: string) {
    this.updateWorkflow(workflowId, (workflow) => ({
      ...workflow,
      status: "completed",
      completedAt: this.dataset.generatedAt,
    }));
    this.logWorkflowEvent(workflowId, "complete", {});
  }

  recordWorkflowFeedback(workflowId: string, userId: string, feedbackType: WorkflowFeedbackType, notes?: string) {
    const feedback: WorkflowFeedbackRecord = {
      id: `feedback-${workflowId}-${feedbackType}`,
      workflowId,
      userId,
      feedbackType,
      notes,
      createdAt: this.dataset.generatedAt,
    };

    this.repository.addFeedback(feedback);
  }

  logWorkflowEvent(workflowId: string, actionType: WorkflowActionRecord["actionType"], actionPayloadJson: Record<string, unknown>) {
    const action: WorkflowActionRecord = {
      id: `action-${workflowId}-${this.repository.workflowActions.length + 1}`,
      workflowId,
      actionType,
      actionPayloadJson,
      status: "logged",
      createdAt: this.dataset.generatedAt,
    };

    this.repository.addAction(action);
  }

  getDashboardWidget(limit = 6) {
    return this.repository.getQueue({ status: "all" }).slice(0, limit);
  }

  getWorkflowQueue(filters: QueueFilters = {}) {
    return this.repository.getQueue(filters);
  }

  getStudentSuggestions(studentId: string) {
    return this.repository.suggestions.filter((suggestion) => suggestion.entityType === "student" && suggestion.entityId === studentId);
  }

  getStudentWorkflows(studentId: string) {
    const suggestionIds = this.getStudentSuggestions(studentId).map((suggestion) => suggestion.id);
    return this.repository.workflows.filter((workflow) => workflow.suggestionId && suggestionIds.includes(workflow.suggestionId));
  }

  getProgramSuggestions(programId: string) {
    const studentIds = this.dataset.students.filter((student) => student.programId === programId).map((student) => student.id);
    const studentSuggestions = this.repository.suggestions.filter(
      (suggestion) => suggestion.entityType === "student" && studentIds.includes(suggestion.entityId),
    );
    const sectionIds = this.dataset.sections.filter((section) => section.programId === programId).map((section) => section.id);
    const sectionSuggestions = this.repository.suggestions.filter(
      (suggestion) => suggestion.entityType === "course_section" && sectionIds.includes(suggestion.entityId),
    );
    return [...studentSuggestions, ...sectionSuggestions];
  }

  getFacultySuggestions() {
    return this.repository.suggestions.filter(
      (suggestion) =>
        suggestion.workflowCode === "faculty_or_course_assignment_imbalance_review" &&
        (suggestion.entityType === "faculty" || suggestion.entityType === "course_section"),
    );
  }

  getSuggestionById(suggestionId: string) {
    return this.requireSuggestion(suggestionId);
  }

  private requireSuggestion(suggestionId: string): ShepherdAiSuggestion {
    const suggestion = this.repository.suggestions.find((item) => item.id === suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} was not found.`);
    }

    return suggestion;
  }

  private updateWorkflow(workflowId: string, updater: (workflow: WorkflowRecord) => WorkflowRecord) {
    this.repository.workflows = this.repository.workflows.map((workflow) =>
      workflow.id === workflowId ? updater(workflow) : workflow,
    );
  }
}
