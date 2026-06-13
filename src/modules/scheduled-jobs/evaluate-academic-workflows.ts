import { AcademyDataset } from "@/modules/academy-data/types";
import { loadRuntimeAcademyDataset } from "@/modules/academy-data/runtime-dataset";
import { InMemoryAcademicWorkflowRepository } from "@/modules/academic-workflows/repository";
import { AcademicWorkflowsService } from "@/modules/academic-workflows/service";
import { aggregateAndEvaluateAcademy } from "@/modules/shepherd-ai/evaluate-for-academy";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";

async function loadDatasetOrFallback(tenantId: string, dataset?: AcademyDataset) {
  return loadRuntimeAcademyDataset(tenantId, { dataset });
}

export async function runAcademicWorkflowEvaluationJob(
  tenantId: string,
  dataset?: AcademyDataset,
  persistenceOverride?: ShepherdAiPostgresRepository | null,
) {
  const resolvedDataset = await loadDatasetOrFallback(tenantId, dataset);
  const persistence =
    persistenceOverride === undefined
      ? process.env.DATABASE_URL
        ? new ShepherdAiPostgresRepository()
        : undefined
      : persistenceOverride ?? undefined;
  const { signals, suggestions } = aggregateAndEvaluateAcademy(resolvedDataset);
  const repository = new InMemoryAcademicWorkflowRepository();
  repository.seedSuggestions(suggestions);

  if (persistence) {
    await persistence.saveSignals(signals);
    await persistence.saveSuggestions(suggestions);
  }

  const workflows = new AcademicWorkflowsService(resolvedDataset, repository);

  const enrollmentSuggestion = suggestions.find((suggestion) => suggestion.workflowCode === "incomplete_enrollment_follow_up");
  if (enrollmentSuggestion) {
    const workflow = workflows.createWorkflow({
      suggestionId: enrollmentSuggestion.id,
      ownerUserId: "user-adrian",
      assignedToUserId: "user-adrian",
      dueAt: "2026-04-25T17:00:00.000Z",
    });
    if (persistence) {
      await persistence.updateSuggestionStatus(resolvedDataset.tenantId, enrollmentSuggestion.id, "promoted_to_workflow");
      await persistence.upsertWorkflow(workflow);
    }
  }

  const documentationSuggestion = suggestions.find((suggestion) => suggestion.workflowCode === "missing_documentation_review");
  if (documentationSuggestion) {
    const workflow = workflows.createWorkflow({
      suggestionId: documentationSuggestion.id,
      ownerUserId: "user-regina",
      assignedToUserId: "user-regina",
      dueAt: "2026-04-26T17:00:00.000Z",
    });
    if (persistence) {
      await persistence.updateSuggestionStatus(resolvedDataset.tenantId, documentationSuggestion.id, "promoted_to_workflow");
      await persistence.upsertWorkflow(workflow);
    }
  }

  const facultySuggestion = suggestions.find((suggestion) => suggestion.workflowCode === "faculty_or_course_assignment_imbalance_review");
  if (facultySuggestion) {
    const workflow = workflows.createWorkflow({
      suggestionId: facultySuggestion.id,
      ownerUserId: "user-sophia",
      assignedToUserId: "user-sophia",
      dueAt: "2026-04-28T17:00:00.000Z",
    });
    workflows.deferWorkflow(workflow.id, "Awaiting term staffing meeting.");
    if (persistence) {
      await persistence.updateSuggestionStatus(resolvedDataset.tenantId, facultySuggestion.id, "promoted_to_workflow");
      const persisted = repository.workflows.find((item) => item.id === workflow.id) ?? workflow;
      await persistence.upsertWorkflow(persisted);
    }
  }

  const transcriptSuggestion = suggestions.find((suggestion) => suggestion.workflowCode === "transcript_or_records_inconsistency_review");
  if (transcriptSuggestion) {
    const workflow = workflows.createWorkflow({
      suggestionId: transcriptSuggestion.id,
      ownerUserId: "user-regina",
      assignedToUserId: "user-regina",
      dueAt: "2026-04-24T17:00:00.000Z",
    });
    workflows.completeWorkflow(workflow.id);
    workflows.recordWorkflowFeedback(workflow.id, "user-regina", "accepted", "Deterministic transcript cross-check was useful.");
    if (persistence) {
      await persistence.updateSuggestionStatus(resolvedDataset.tenantId, transcriptSuggestion.id, "promoted_to_workflow");
      const persisted = repository.workflows.find((item) => item.id === workflow.id) ?? workflow;
      await persistence.upsertWorkflow(persisted);
    }
  }

  if (persistence) {
    for (const action of repository.workflowActions) {
      await persistence.insertWorkflowAction(action);
    }

    for (const feedback of repository.workflowFeedback) {
      await persistence.insertWorkflowFeedback(feedback);
    }

    repository.seedSuggestions(await persistence.fetchSuggestions(resolvedDataset.tenantId));
    repository.workflows = await persistence.fetchWorkflows(resolvedDataset.tenantId);
    repository.workflowActions = await persistence.fetchWorkflowActions(resolvedDataset.tenantId);
    repository.workflowFeedback = await persistence.fetchWorkflowFeedback(resolvedDataset.tenantId);
  }

  return {
    dataset: resolvedDataset,
    signals,
    suggestions: repository.suggestions,
    repository,
    workflows,
  };
}
