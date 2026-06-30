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

interface SuggestionSnoozeService {
  snoozeSuggestion(tenantId: string, suggestionId: string, snoozeUntil: string): Promise<Pick<ShepherdAiSuggestion, "id" | "status">>;
}

export async function snoozeSuggestionForActor(
  service: SuggestionSnoozeService,
  actor: AcademyActor,
  suggestionId: string,
  snoozeUntil: string,
) {
  assertShepherdAiAccess(actor, actor.tenantId, "write");
  return service.snoozeSuggestion(actor.tenantId, suggestionId, snoozeUntil);
}

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));
  const snoozeUntil = typeof body.snoozeUntil === "string" ? body.snoozeUntil : undefined;

  if (!snoozeUntil) {
    return new Response(JSON.stringify({ error: "snoozeUntil (ISO string) is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await context.params;
    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "shepherdAiRecommendations");
      const suggestion = await snoozeSuggestionForActor(
        new AcademicWorkflowsPostgresService(
          asAcademyDatabase(client),
          false,
        ),
        actor,
        id,
        snoozeUntil,
      );
      return { suggestion };
    });
  });
}
