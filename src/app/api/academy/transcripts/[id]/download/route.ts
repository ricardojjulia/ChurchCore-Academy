import { handleApi } from "@/app/api/academy/api-utils";
import {
  withAcademyDatabaseContext,
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import {
  PostgresTranscriptRepository,
  type TranscriptDatabase,
} from "@/modules/transcripts/postgres-repository";
import { hasTranscriptAdminAccess } from "@/modules/transcripts/service";
import { getTranscriptSignedUrl } from "@/modules/transcripts/storage";
import type { TranscriptStorageClient } from "@/modules/transcripts/storage";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

interface TranscriptDownloadDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
  storageClient?: TranscriptStorageClient;
}

function makeStorageClient(): TranscriptStorageClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error(
      "Supabase URL and service role key are required for storage access.",
    );
  }

  const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRole);

  return {
    async upload(bucket, path, buffer, contentType) {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, buffer, { contentType, upsert: true });
      if (error) throw error;
    },
    async exists(bucket, path) {
      const pathParts = path.split("/");
      const fileName = pathParts.pop();
      const dirPath = pathParts.join("/") || "";

      const { data } = await supabase.storage
        .from(bucket)
        .list(dirPath, { search: fileName ?? "" });
      return (data?.length ?? 0) > 0;
    },
    async signedUrl(bucket, path, expiresInSeconds) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);
      if (error || !data?.signedUrl)
        throw error ?? new Error("Failed to create signed URL");
      return data.signedUrl;
    },
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: TranscriptDownloadDependencies = {},
) {
  return handleApi(async () => {
    const { id } = await params;
    if (!id) throw new Error("Transcript id is required.");

    const actor = await (
      dependencies.resolveActor ??
      (async (currentRequest) =>
        (await resolveAcademyActorFromSession(currentRequest)).actor)
    )(request);

    // Fetch the transcript record to verify ownership and status
    const transcript = await withAcademyDatabaseContext(
      actor,
      async (client) => {
        const repository = new PostgresTranscriptRepository(
          asAcademyDatabase<TranscriptDatabase>(client),
        );
        return repository.findById(actor.tenantId, id);
      },
    );

    if (!transcript) {
      throw new Error("Transcript not found.");
    }

    // Tenant isolation: transcript tenantId must match actor tenantId
    if (transcript.tenantId !== actor.tenantId) {
      throw new AcademyAuthorizationError("Cross-tenant access denied.");
    }

    // Authorization: student can only download own released transcripts
    // Admin/registrar can download any released transcript
    const isAdmin = hasTranscriptAdminAccess(actor);
    const isOwnTranscript = transcript.studentPersonId === actor.userId;

    if (!isAdmin && !isOwnTranscript) {
      throw new AcademyAuthorizationError(
        "You can only download your own transcripts.",
      );
    }

    // Get signed URL using storage client
    const storage =
      dependencies.storageClient ?? makeStorageClient();
    const signedUrl = await getTranscriptSignedUrl(
      transcript.tenantId,
      transcript.studentPersonId,
      transcript.id,
      transcript.status,
      storage,
    );

    if (!signedUrl) {
      throw new Error(
        "Transcript PDF is not available for download. Only released transcripts can be downloaded.",
      );
    }

    // Redirect to signed URL
    return NextResponse.redirect(signedUrl, { status: 302 });
  });
}
