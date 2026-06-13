import { NextRequest } from "next/server";
import { getStringParam, handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor, assertShepherdAiAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { InMemoryAcademicWorkflowRepository } from "@/modules/academic-workflows/repository";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import { QueueFilters, ShepherdAiSuggestion, WorkflowActionRecord, WorkflowFeedbackRecord, WorkflowRecord } from "@/modules/shepherd-ai/types";

interface WorkflowQueueReader {
  fetchSuggestions(tenantId: string): Promise<ShepherdAiSuggestion[]>;
  fetchWorkflows(tenantId: string): Promise<WorkflowRecord[]>;
  fetchWorkflowActions(tenantId: string): Promise<WorkflowActionRecord[]>;
  fetchWorkflowFeedback(tenantId: string): Promise<WorkflowFeedbackRecord[]>;
}

export async function buildWorkflowQueuePayload(
  repositoryReader: WorkflowQueueReader,
  actor: AcademyActor,
  filters: QueueFilters,
) {
  assertShepherdAiAccess(actor, actor.tenantId, "read");

  const [suggestions, workflows, workflowActions, workflowFeedback] = await Promise.all([
    repositoryReader.fetchSuggestions(actor.tenantId),
    repositoryReader.fetchWorkflows(actor.tenantId),
    repositoryReader.fetchWorkflowActions(actor.tenantId),
    repositoryReader.fetchWorkflowFeedback(actor.tenantId),
  ]);

  const repository = new InMemoryAcademicWorkflowRepository(suggestions, workflows, workflowActions, workflowFeedback);
  const queue = repository.getQueue(filters);

  return {
    queue,
    suggestions,
    workflows,
    workflowActions,
    workflowFeedback,
    count: queue.length,
  };
}

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const searchParams = request.nextUrl.searchParams;
    const filters: QueueFilters = {
      urgency: getStringParam(searchParams.get("urgency") ?? undefined) as QueueFilters["urgency"],
      status: getStringParam(searchParams.get("status") ?? undefined) as QueueFilters["status"],
      workflowCode: getStringParam(searchParams.get("workflowCode") ?? undefined) as QueueFilters["workflowCode"],
      assignee: getStringParam(searchParams.get("assignee") ?? undefined),
    };

    return withAcademyDatabaseContext(actor, (client) =>
      buildWorkflowQueuePayload(
        new ShepherdAiPostgresRepository(asAcademyDatabase(client)),
        actor,
        filters,
      ),
    );
  });
}
