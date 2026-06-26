import {
  withAcademyDatabaseContext,
  asAcademyDatabase,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  AcademyAuthenticationError,
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import {
  PostgresTranscriptRepository,
  type TranscriptDatabase,
} from "@/modules/transcripts/postgres-repository";
import { hasTranscriptAdminAccess } from "@/modules/transcripts/service";
import {
  generateTranscriptPdf,
  getTranscriptSignedUrl,
} from "@/modules/transcripts/storage";
import type { TranscriptStorageClient } from "@/modules/transcripts/storage";
import { buildTranscriptPdfData } from "@/modules/transcripts/pdf-data-builder";
import type { TranscriptPdfData } from "@/modules/transcripts/pdf-generator";
import type { TranscriptRecord } from "@/modules/transcripts/types";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

interface TranscriptDownloadDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
  findById?: (
    actor: AcademyActor,
    transcriptId: string,
  ) => Promise<TranscriptRecord | null>;
  storageClient?: TranscriptStorageClient;
  buildPdfData?: (
    actor: AcademyActor,
    transcript: TranscriptRecord,
  ) => Promise<TranscriptPdfData>;
  generatePdf?: (
    data: TranscriptPdfData,
    issuanceId: string,
    storage: TranscriptStorageClient,
  ) => Promise<{ path: string; signedUrl: string }>;
  updateStorageUrl?: (
    actor: AcademyActor,
    transcriptId: string,
    storagePath: string,
  ) => Promise<void>;
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

async function defaultFindById(actor: AcademyActor, transcriptId: string) {
  return withAcademyDatabaseContext(
    actor,
    async (client) => {
      const repository = new PostgresTranscriptRepository(
        asAcademyDatabase<TranscriptDatabase>(client),
      );
      return repository.findById(actor.tenantId, transcriptId);
    },
  );
}

async function defaultBuildPdfData(
  actor: AcademyActor,
  transcript: TranscriptRecord,
) {
  return withAcademyDatabaseContext(actor, async (client) =>
    buildTranscriptPdfData({
      tenantId: actor.tenantId,
      studentPersonId: transcript.studentPersonId,
      issuanceId: transcript.id,
      issuanceDate: new Date(transcript.releasedAt ?? transcript.issuedAt)
        .toISOString()
        .split("T")[0],
      client: asAcademyDatabase(client),
    }),
  );
}

async function defaultUpdateStorageUrl(
  actor: AcademyActor,
  transcriptId: string,
  storagePath: string,
) {
  await withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresTranscriptRepository(
      asAcademyDatabase<TranscriptDatabase>(client),
    );
    await repository.updateStorageUrl(actor.tenantId, transcriptId, storagePath);
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: TranscriptDownloadDependencies = {},
) {
  try {
    const { id } = await params;
    if (!id) throw new Error("Transcript id is required.");

    const actor = await (
      dependencies.resolveActor ??
      (async (currentRequest) =>
        (await resolveAcademyActorFromSession(currentRequest)).actor)
    )(request);

    const transcript = await (dependencies.findById ?? defaultFindById)(
      actor,
      id,
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

    if (transcript.status !== "released") {
      throw new AcademyAuthorizationError(
        "Only released transcript PDFs can be downloaded.",
      );
    }

    const storage =
      dependencies.storageClient ?? makeStorageClient();
    const signedUrl = await getTranscriptSignedUrl(
      transcript.tenantId,
      transcript.studentPersonId,
      transcript.id,
      transcript.status,
      storage,
    );

    if (signedUrl) {
      return NextResponse.redirect(signedUrl, { status: 302 });
    }

    const pdfData = await (dependencies.buildPdfData ?? defaultBuildPdfData)(
      actor,
      transcript,
    );
    const generated = await (dependencies.generatePdf ?? generateTranscriptPdf)(
      pdfData,
      transcript.id,
      storage,
    );
    await (dependencies.updateStorageUrl ?? defaultUpdateStorageUrl)(
      actor,
      transcript.id,
      generated.path,
    );

    return NextResponse.redirect(generated.signedUrl, { status: 302 });
  } catch (error) {
    return mapDownloadError(error);
  }
}

function mapDownloadError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected API error.";

  if (error instanceof AcademyAuthenticationError) {
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (
    error instanceof AcademyAuthorizationError ||
    message.includes("Forbidden")
  ) {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  if (error instanceof AcademyConflictError) {
    return NextResponse.json({ error: message }, { status: 409 });
  }

  if (message.includes("not found") || message.includes("was not found")) {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  if (message.includes(" is required") || message.includes(" are required")) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: "Unexpected API error." }, { status: 500 });
}
