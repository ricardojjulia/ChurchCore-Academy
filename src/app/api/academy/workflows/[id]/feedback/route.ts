import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { AcademyActor, assertShepherdAiAccess } from "@/modules/academy-auth/policy";
import { resolveBootstrapAcademyActor } from "@/modules/academy-auth/request-context";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";
import { WorkflowFeedbackRecord, WorkflowFeedbackType } from "@/modules/shepherd-ai/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const feedbackTypes = new Set<WorkflowFeedbackType>(["accepted", "needs_tuning", "not_useful"]);

interface WorkflowFeedbackService {
  recordFeedback(
    tenantId: string,
    workflowId: string,
    userId: string,
    feedbackType: WorkflowFeedbackType,
    notes?: string,
  ): Promise<WorkflowFeedbackRecord>;
}

export async function recordWorkflowFeedbackForActor(
  service: WorkflowFeedbackService,
  actor: AcademyActor,
  workflowId: string,
  userId: string,
  feedbackType: WorkflowFeedbackType,
  notes?: string,
) {
  assertShepherdAiAccess(actor, actor.tenantId, "write");
  return service.recordFeedback(actor.tenantId, workflowId, userId, feedbackType, notes);
}

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : undefined;
  const feedbackType = typeof body.feedbackType === "string" ? body.feedbackType : undefined;
  const notes = typeof body.notes === "string" ? body.notes : undefined;

  if (!userId) {
    return jsonError("userId is required.", 400);
  }

  if (!feedbackType || !feedbackTypes.has(feedbackType as WorkflowFeedbackType)) {
    return jsonError("feedbackType must be accepted, needs_tuning, or not_useful.", 400);
  }

  return handleApi(async () => {
    const actor = resolveBootstrapAcademyActor(request.headers);
    const { id } = await context.params;
    const feedback = await recordWorkflowFeedbackForActor(
      new AcademicWorkflowsPostgresService(),
      actor,
      id,
      userId,
      feedbackType as WorkflowFeedbackType,
      notes,
    );
    return { feedback };
  });
}

