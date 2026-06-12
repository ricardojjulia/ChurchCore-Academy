import { handleApi } from "@/app/api/academy/api-utils";
import { AcademyActor, assertShepherdAiAccess } from "@/modules/academy-auth/policy";
import { resolveBootstrapAcademyActor } from "@/modules/academy-auth/request-context";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";
import { ShepherdAiSuggestion } from "@/modules/shepherd-ai/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface SuggestionDismissalService {
  dismissSuggestion(tenantId: string, suggestionId: string, note?: string): Promise<Pick<ShepherdAiSuggestion, "id" | "status">>;
}

export async function dismissSuggestionForActor(
  service: SuggestionDismissalService,
  actor: AcademyActor,
  suggestionId: string,
  note?: string,
) {
  assertShepherdAiAccess(actor, actor.tenantId, "write");
  return service.dismissSuggestion(actor.tenantId, suggestionId, note);
}

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note : undefined;

  return handleApi(async () => {
    const actor = resolveBootstrapAcademyActor(request.headers);
    const { id } = await context.params;
    const suggestion = await dismissSuggestionForActor(new AcademicWorkflowsPostgresService(), actor, id, note);
    return { suggestion };
  });
}

