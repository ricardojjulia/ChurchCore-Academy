import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const assignedToUserId = typeof body.assignedToUserId === "string" ? body.assignedToUserId : undefined;

  if (!assignedToUserId) {
    return jsonError("assignedToUserId is required.", 400);
  }

  return handleApi(async () => {
    const { id } = await context.params;
    const workflow = await new AcademicWorkflowsPostgresService().assignWorkflow(id, assignedToUserId);
    return { workflow };
  });
}

