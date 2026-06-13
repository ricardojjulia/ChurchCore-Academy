import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor, assertShepherdAiAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
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
  return recordWorkflowFeedbackRequest(request, context);
}

export async function recordWorkflowFeedbackRequest(
  request: Request,
  context: RouteContext,
  service?: WorkflowFeedbackService,
  resolveActor: (
    request: Request,
  ) => Promise<{ actor: AcademyActor }> = resolveAcademyActorFromSession,
) {
  const body = await request.json().catch(() => ({}));
  const requestedUserId = typeof body.userId === "string" ? body.userId : undefined;
  const feedbackType = typeof body.feedbackType === "string" ? body.feedbackType : undefined;
  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const { actor } = await resolveActor(request);

  if (requestedUserId && requestedUserId !== actor.userId) {
    return jsonError("Forbidden workflow feedback actor.", 403);
  }

  if (!feedbackType || !feedbackTypes.has(feedbackType as WorkflowFeedbackType)) {
    return jsonError("feedbackType must be accepted, needs_tuning, or not_useful.", 400);
  }

  return handleApi(async () => {
    const { id } = await context.params;
    const recordFeedback = (resolvedService: WorkflowFeedbackService) =>
      recordWorkflowFeedbackForActor(
        resolvedService,
        actor,
        id,
        actor.userId,
        feedbackType as WorkflowFeedbackType,
        notes,
      );

    if (service) {
      return { feedback: await recordFeedback(service) };
    }

    return withAcademyDatabaseContext(actor, async (client) => ({
      feedback: await recordFeedback(
        new AcademicWorkflowsPostgresService(
          asAcademyDatabase(client),
          false,
        ),
      ),
    }));
  });
}
