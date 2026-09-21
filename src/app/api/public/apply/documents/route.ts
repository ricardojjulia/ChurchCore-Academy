import { getDatabasePool } from "@/lib/database";
import {
  PublicApplicationService,
  PublicApplicationNotFoundError,
} from "@/modules/admissions/public-application-service";
import { PostgresDocumentChecklistRepository } from "@/modules/admissions/document-checklist-repository";
import { NextResponse } from "next/server";

function resolveTenantId(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("tenant");
  if (fromQuery) return fromQuery;
  const defaultTenant = process.env.ACADEMY_DEFAULT_TENANT_ID;
  if (defaultTenant) return defaultTenant;
  throw new Error("Unable to resolve institution. Tenant context is required.");
}

export async function GET(request: Request) {
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

    const repository = new PostgresDocumentChecklistRepository(db);
    const items = await repository.listApplicationDocumentItems(
      tenantId,
      resolved.applicationId,
    );

    // Compute completion percentage
    const requiredItems = items.filter((item) => item.isRequired);
    const satisfiedRequiredItems = requiredItems.filter(
      (item) => item.status === "reviewed" || item.status === "waived",
    );
    const completionPct =
      requiredItems.length === 0
        ? 100
        : Math.round(
            (satisfiedRequiredItems.length / requiredItems.length) * 100,
          );

    // Public, unauthenticated endpoint — never expose internal storage paths
    // or staff identifiers, only what an applicant needs to see.
    const publicItems = items.map((item) => ({
      id: item.id,
      label: item.label,
      isRequired: item.isRequired,
      status: item.status,
      officerNote: item.officerNote,
      // Only surface waiverNote when the item is actually waived — the DB constraint
      // requires it to be set whenever status = 'waived', but doesn't prevent it from
      // being populated for another status by some future writer.
      waiverNote: item.status === "waived" ? item.waiverNote : undefined,
      uploadedAt: item.uploadedAt,
    }));

    return NextResponse.json({ items: publicItems, completionPct });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error.";

    if (error instanceof PublicApplicationNotFoundError) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error("[public/apply/documents GET] Unexpected error:", message);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
