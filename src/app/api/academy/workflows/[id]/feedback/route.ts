import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const feedbackTypes = new Set(["accepted", "needs_tuning", "not_useful"]);

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : undefined;
  const feedbackType = typeof body.feedbackType === "string" ? body.feedbackType : undefined;
  const notes = typeof body.notes === "string" ? body.notes : undefined;

  if (!userId) {
    return jsonError("userId is required.", 400);
  }

  if (!feedbackType || !feedbackTypes.has(feedbackType)) {
    return jsonError("feedbackType must be accepted, needs_tuning, or not_useful.", 400);
  }

  return handleApi(async () => {
    const { id } = await context.params;
    const feedback = await new AcademicWorkflowsPostgresService().recordFeedback(id, userId, feedbackType, notes);
    return { feedback };
  });
}

