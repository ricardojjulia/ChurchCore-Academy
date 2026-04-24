import { handleApi } from "@/app/api/academy/api-utils";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  return handleApi(async () => {
    const { id } = await context.params;
    const workflow = await new AcademicWorkflowsPostgresService().deferWorkflow(id, reason);
    return { workflow };
  });
}

