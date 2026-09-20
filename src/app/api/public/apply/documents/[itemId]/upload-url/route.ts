import { getDatabasePool } from "@/lib/database";
import {
  PublicApplicationService,
  PublicApplicationNotFoundError,
} from "@/modules/admissions/public-application-service";
import { PostgresDocumentChecklistRepository } from "@/modules/admissions/document-checklist-repository";
import { createStorageClient } from "@/lib/supabase/storage-client";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

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
    const filename = body.filename;

    if (!filename || typeof filename !== "string") {
      return NextResponse.json(
        { error: "filename is required in request body." },
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

    // A token holder must not be able to obtain a new upload slot for an
    // item staff already reviewed — that decision is not theirs to undo.
    if (item.status !== "pending" && item.status !== "resubmission_required") {
      return NextResponse.json(
        { error: "This document has already been reviewed and cannot be replaced." },
        { status: 409 },
      );
    }

    // Sanitize filename: extract extension, validate it's .pdf
    const extensionMatch = filename.toLowerCase().match(/\.(pdf)$/);
    if (!extensionMatch) {
      return NextResponse.json(
        { error: "Only PDF files are accepted." },
        { status: 400 },
      );
    }

    // Generate safe storage path
    const uuid = randomUUID();
    const storagePath = `${tenantId}/applications/${resolved.applicationId}/${itemId}/${uuid}.pdf`;

    const storageClient = createStorageClient();
    const signedUploadUrl = await storageClient.generateSignedUploadUrl(
      storagePath,
      180,
    );

    return NextResponse.json({ signedUploadUrl, storagePath });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error.";

    if (error instanceof PublicApplicationNotFoundError) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error(
      "[public/apply/documents/[itemId]/upload-url POST] Unexpected error:",
      message,
    );
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
