import { handleApi } from "@/app/api/academy/api-utils";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";

export async function GET() {
  return handleApi(async () => {
    const suggestions = await new ShepherdAiPostgresRepository().fetchSuggestions();
    return {
      suggestions,
      count: suggestions.length,
    };
  });
}

