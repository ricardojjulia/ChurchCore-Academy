import { NextRequest } from "next/server";
import { getStringParam, handleApi } from "@/app/api/academy/api-utils";
import { InMemoryAcademicWorkflowRepository } from "@/modules/academic-workflows/repository";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import { QueueFilters } from "@/modules/shepherd-ai/types";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const searchParams = request.nextUrl.searchParams;
    const shepherdRepository = new ShepherdAiPostgresRepository();
    const [suggestions, workflows, workflowActions, workflowFeedback] = await Promise.all([
      shepherdRepository.fetchSuggestions(),
      shepherdRepository.fetchWorkflows(),
      shepherdRepository.fetchWorkflowActions(),
      shepherdRepository.fetchWorkflowFeedback(),
    ]);

    const repository = new InMemoryAcademicWorkflowRepository(suggestions, workflows, workflowActions, workflowFeedback);
    const filters: QueueFilters = {
      urgency: getStringParam(searchParams.get("urgency") ?? undefined) as QueueFilters["urgency"],
      status: getStringParam(searchParams.get("status") ?? undefined) as QueueFilters["status"],
      workflowCode: getStringParam(searchParams.get("workflowCode") ?? undefined) as QueueFilters["workflowCode"],
      assignee: getStringParam(searchParams.get("assignee") ?? undefined),
    };

    const queue = repository.getQueue(filters);

    return {
      queue,
      suggestions,
      workflows,
      workflowActions,
      workflowFeedback,
      count: queue.length,
    };
  });
}

