import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { getAidLetterSignedUrl, LetterDatabaseClient, LetterStorageClient } from "@/modules/financial-aid/aid-letter-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: packageId } = await context.params;

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const storage: LetterStorageClient = {
      upload: async () => { throw new Error("not used"); },
      exists: async (bucket, path) => {
        const { data } = await supabase.storage.from(bucket).list(path.split("/").slice(0, -1).join("/"), {
          search: path.split("/").at(-1),
        });
        return Array.isArray(data) && data.length > 0;
      },
      signedUrl: async (bucket, path, ttl) => {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
        if (error || !data) throw new Error("Failed to generate signed URL.");
        return data.signedUrl;
      },
    };

    return withAcademyDatabaseContext(actor, async (client) => {
      const url = await getAidLetterSignedUrl(
        actor,
        packageId,
        storage,
        asAcademyDatabase<LetterDatabaseClient>(client),
      );
      return { url };
    });
  });
}
