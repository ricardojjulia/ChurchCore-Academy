import { getDatabasePool } from "@/lib/database";
import {
  PublicApplicationService,
  PublicApplicationNotFoundError,
} from "@/modules/admissions/public-application-service";
import { PostgresDocumentChecklistRepository } from "@/modules/admissions/document-checklist-repository";
import { createStorageClient } from "@/lib/supabase/storage-client";
import { NextResponse } from "next/server";

function resolveTenantId(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("tenant");
  if (fromQuery) return fromQuery;
  const defaultTenant = process.env.ACADEMY_DEFAULT_TENANT_ID;
  if (defaultTenant) return defaultTenant;
  throw new Error("Unable to resolve institution. Tenant context is required.");
}

type RouteContext = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const url = new URL(request.url);
    const statusToken = url.searchParams.get("token")?.trim();

    if (!statusToken) {
      return NextResponse.json(
        { error: "token query parameter is required." },
        { status: 400 },
      );
    }

    const tenantId = resolveTenantId(request);
    const db = getDatabasePool();
    const service = new PublicApplicationService(db);
    const resolved = await service.resolveApplicationByToken(
      tenantId,
      statusToken,
    );

    if (!resolved) {
      throw new PublicApplicationNotFoundError(
        "Application status token was not found.",
      );
    }

    const { itemId } = await context.params;
    const body = await request.json();
    const { storagePath, storageFilename, contentType, fileSizeBytes } = body;

    if (!storagePath || typeof storagePath !== "string") {
      return NextResponse.json(
        { error: "storagePath is required in request body." },
        { status: 400 },
      );
    }

    if (!storageFilename || typeof storageFilename !== "string") {
      return NextResponse.json(
        { error: "storageFilename is required in request body." },
        { status: 400 },
      );
    }

    if (!contentType || typeof contentType !== "string") {
      return NextResponse.json(
        { error: "contentType is required in request body." },
        { status: 400 },
      );
    }

    if (typeof fileSizeBytes !== "number") {
      return NextResponse.json(
        { error: "fileSizeBytes is required in request body." },
        { status: 400 },
      );
    }

    // Server-side validation
    if (contentType !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF documents are accepted." },
        { status: 400 },
      );
    }

    const maxSizeBytes = 10 * 1024 * 1024;
    if (fileSizeBytes > maxSizeBytes) {
      return NextResponse.json(
        { error: "Document file size exceeds the 10MB limit." },
        { status: 400 },
      );
    }

    const repository = new PostgresDocumentChecklistRepository(db);
    const item = await repository.findApplicationDocumentItemById(
      tenantId,
      itemId,
    );

    if (!item) {
      return NextResponse.json(
        { error: "Document item not found." },
        { status: 404 },
      );
    }

    if (item.applicationId !== resolved.applicationId) {
      return NextResponse.json(
        { error: "Document item does not belong to this application." },
        { status: 403 },
      );
    }

    // The client only ever learns a storagePath from this same flow's
    // upload-url response, which always has this exact prefix. Reject any
    // other value rather than trusting a client-supplied storage path.
    const expectedPrefix = `${tenantId}/applications/${resolved.applicationId}/${itemId}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "storagePath does not match this document item." },
        { status: 400 },
      );
    }

    const oldStoragePath = item.storagePath;

    const updatedItem = await repository.updateDocumentItemUpload(
      tenantId,
      itemId,
      storagePath,
      storageFilename,
      new Date().toISOString(),
    );

    // Best-effort cleanup of old file
    if (oldStoragePath) {
      try {
        const storageClient = createStorageClient();
        await storageClient.delete(oldStoragePath);
      } catch (cleanupError) {
        console.error(
          "[public/apply/documents/[itemId]/confirm POST] Failed to delete old file:",
          cleanupError instanceof Error ? cleanupError.message : "unknown",
        );
        // Continue — cleanup failure should not fail the upload
      }
    }

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error.";

    if (error instanceof PublicApplicationNotFoundError) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error(
      "[public/apply/documents/[itemId]/confirm POST] Unexpected error:",
      message,
    );
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
