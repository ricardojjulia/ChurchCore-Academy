import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { generateAidAwardLetterPdf, LetterDatabaseClient, LetterStorageClient } from "@/modules/financial-aid/aid-letter-service";
import { CommunicationsService } from "@/modules/communications/service";
import { PostgresCommunicationsRepository } from "@/modules/communications/postgres-repository";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: packageId } = await context.params;
    const body = await request.json();

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const storage: LetterStorageClient = {
      upload: async (bucket, path, buffer, contentType) => {
        const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType, upsert: true });
        if (error) throw new Error(`Storage upload failed: ${error.message}`);
      },
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
      const commRepo = new PostgresCommunicationsRepository(asAcademyDatabase(client));
      const commService = new CommunicationsService(commRepo);
      return generateAidAwardLetterPdf(
        actor,
        {
          packageId,
          costOfAttendance: body.costOfAttendance ? Number(body.costOfAttendance) : undefined,
          costOfAttendanceLabel: body.costOfAttendanceLabel ? String(body.costOfAttendanceLabel) : undefined,
          acceptanceDeadline: body.acceptanceDeadline ? String(body.acceptanceDeadline) : undefined,
        },
        storage,
        commService,
        asAcademyDatabase<LetterDatabaseClient>(client),
      );
    });
  });
}
