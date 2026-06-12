import { academyDataset } from "@/modules/academy-data/mock-data";
import { AcademyDataRepository } from "@/modules/academy-data/postgres-repository";
import { AcademyDataset } from "@/modules/academy-data/types";
import { InMemoryAcademicWorkflowRepository } from "@/modules/academic-workflows/repository";
import { AcademicWorkflowsService } from "@/modules/academic-workflows/service";
import { aggregateAndEvaluateAcademy } from "@/modules/shepherd-ai/evaluate-for-academy";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";

async function loadDatasetOrFallback(tenantId: string, dataset?: AcademyDataset) {
  if (dataset) {
    return dataset;
  }

  if (process.env.DATABASE_URL) {
    try {
      return await new AcademyDataRepository().loadDataset(tenantId);
    } catch {
      return academyDataset;
    }
  }

  return academyDataset;
}

export async function runAcademicWorkflowEvaluationJob(tenantId: string, dataset?: AcademyDataset) {
  const resolvedDataset = await loadDatasetOrFallback(tenantId, dataset);
  let persistence = process.env.DATABASE_URL ? new ShepherdAiPostgresRepository() : undefined;
  const { signals, suggestions } = aggregateAndEvaluateAcademy(resolvedDataset);
  const repository = new InMemoryAcademicWorkflowRepository();
  repository.seedSuggestions(suggestions);

  if (persistence) {
    try {
      await persistence.saveSignals(signals);
      await persistence.saveSuggestions(suggestions);
    } catch {
      persistence = undefined;
    }
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
    try {
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
    } catch {
      persistence = undefined;
    }
  }

  return {
    dataset: resolvedDataset,
    signals,
    suggestions: repository.suggestions,
    repository,
    workflows,
  };
}
