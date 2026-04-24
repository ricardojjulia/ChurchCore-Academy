import { handleApi } from "@/app/api/academy/api-utils";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { id } = await context.params;
    const workflow = await new AcademicWorkflowsPostgresService().completeWorkflow(id);
    return { workflow };
  });
}

