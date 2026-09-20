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

// Matches exactly what upload-url generates: {uuid}.pdf, nothing else. A plain
// prefix check (storagePath.startsWith(expectedPrefix)) would still accept
// "{prefix}../../../other-file.pdf", since startsWith does not normalize the
// path — this regex only accepts a single canonical filename component.
const UUID_PDF_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

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

    // Server-side validation of the CLAIMED metadata (belt); the ACTUAL
    // uploaded object is re-checked below (suspenders) since the signed
    // upload URL itself enforces no type/size constraint.
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

    // A token holder must not be able to modify an item staff already
    // reviewed — that decision is not theirs to undo. Only pending/
    // resubmission_required items may be confirmed.
    if (item.status !== "pending" && item.status !== "resubmission_required") {
      return NextResponse.json(
        { error: "This document has already been reviewed and cannot be replaced." },
        { status: 409 },
      );
    }

    // storagePath must be exactly this item's prefix plus a single
    // UUID.pdf filename component — rejects traversal and cross-item paths.
    const expectedPrefix = `${tenantId}/applications/${resolved.applicationId}/${itemId}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "storagePath does not match this document item." },
        { status: 400 },
      );
    }
    const suffix = storagePath.slice(expectedPrefix.length);
    if (!UUID_PDF_FILENAME.test(suffix) || suffix.includes("/")) {
      return NextResponse.json(
        { error: "storagePath does not match this document item." },
        { status: 400 },
      );
    }

    // Re-verify against the ACTUAL uploaded object, not just what the
    // client claims — the signed upload URL itself enforces neither type
    // nor size, so a caller could PUT arbitrary bytes with a forged
    // Content-Type and then claim a smaller/PDF size here.
    const storageClient = createStorageClient();
    const actualMetadata = await storageClient.getObjectMetadata(storagePath);
    if (!actualMetadata) {
      return NextResponse.json(
        { error: "Uploaded file not found. Please try uploading again." },
        { status: 400 },
      );
    }
    if (actualMetadata.contentType !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF documents are accepted." },
        { status: 400 },
      );
    }
    if (actualMetadata.size > maxSizeBytes) {
      return NextResponse.json(
        { error: "Document file size exceeds the 10MB limit." },
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
        await storageClient.delete(oldStoragePath);
      } catch (cleanupError) {
        console.error(
          "[public/apply/documents/[itemId]/confirm POST] Failed to delete old file:",
          cleanupError instanceof Error ? cleanupError.message : "unknown",
        );
        // Continue — cleanup failure should not fail the upload
      }
    }

    // Public, unauthenticated endpoint — never expose internal storage
    // paths or staff identifiers, same as GET /api/public/apply/documents.
    return NextResponse.json({
      item: {
        id: updatedItem.id,
        label: updatedItem.label,
        isRequired: updatedItem.isRequired,
        status: updatedItem.status,
        officerNote: updatedItem.officerNote,
        uploadedAt: updatedItem.uploadedAt,
      },
    });
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
