import { handleApi } from "@/app/api/academy/api-utils";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note : undefined;

  return handleApi(async () => {
    const { id } = await context.params;
    const suggestion = await new AcademicWorkflowsPostgresService().dismissSuggestion(id, note);
    return { suggestion };
  });
}

