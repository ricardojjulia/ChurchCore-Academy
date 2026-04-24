import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const ownerUserId = typeof body.ownerUserId === "string" ? body.ownerUserId : undefined;
  const assignedToUserId = typeof body.assignedToUserId === "string" ? body.assignedToUserId : undefined;
  const dueAt = typeof body.dueAt === "string" ? body.dueAt : undefined;

  if (!ownerUserId) {
    return jsonError("ownerUserId is required.", 400);
  }

  return handleApi(async () => {
    const { id } = await context.params;
    const workflow = await new AcademicWorkflowsPostgresService().promoteSuggestion(id, ownerUserId, assignedToUserId, dueAt);
    return { workflow };
  });
}

