import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { AcademyActor, assertShepherdAiAccess } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import { ShepherdAiSuggestion } from "@/modules/shepherd-ai/types";

interface ShepherdSuggestionReader {
  fetchSuggestions(tenantId: string): Promise<ShepherdAiSuggestion[]>;
}

export async function buildShepherdSuggestionsPayload(
  repository: ShepherdSuggestionReader,
  actor: AcademyActor,
  tenantId: string,
) {
  assertShepherdAiAccess(actor, tenantId, "read");

  const suggestions = await repository.fetchSuggestions(tenantId);
  return {
    suggestions,
    count: suggestions.length,
  };
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, (client) =>
      buildShepherdSuggestionsPayload(
        new ShepherdAiPostgresRepository(asAcademyDatabase(client)),
        actor,
        actor.tenantId,
      ),
    );
  });
}
