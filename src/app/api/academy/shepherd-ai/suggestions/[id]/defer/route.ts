import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { AcademyActor, assertShepherdAiAccess, assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";
import { ShepherdAiSuggestion } from "@/modules/shepherd-ai/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface SuggestionDeferralService {
  deferSuggestion(tenantId: string, suggestionId: string, reason?: string): Promise<Pick<ShepherdAiSuggestion, "id" | "status">>;
}

export async function deferSuggestionForActor(
  service: SuggestionDeferralService,
  actor: AcademyActor,
  suggestionId: string,
  reason?: string,
) {
  assertShepherdAiAccess(actor, actor.tenantId, "write");
  return service.deferSuggestion(actor.tenantId, suggestionId, reason);
}

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await context.params;
    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "shepherdAiRecommendations");
      const suggestion = await deferSuggestionForActor(
        new AcademicWorkflowsPostgresService(
          asAcademyDatabase(client),
          false,
        ),
        actor,
        id,
        reason,
      );
      return { suggestion };
    });
  });
}
