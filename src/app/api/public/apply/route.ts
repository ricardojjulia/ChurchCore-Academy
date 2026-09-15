import { getDatabasePool } from "@/lib/database";
import {
  PublicApplicationService,
  PublicApplicationValidationError,
  PublicApplicationRateLimitError,
} from "@/modules/admissions/public-application-service";
import { NextResponse } from "next/server";

function resolveTenantId(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("tenant");
  if (fromQuery) return fromQuery;
  // Fall back to env default for single-tenant deployments
  const defaultTenant = process.env.ACADEMY_DEFAULT_TENANT_ID;
  if (defaultTenant) return defaultTenant;
  throw new Error("Unable to resolve institution. Tenant context is required.");
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown"
  );
}

export async function POST(request: Request) {
  try {
    const tenantId = resolveTenantId(request);
    const clientIp = getClientIp(request);

    const body = await request.json().catch(() => {
      throw new PublicApplicationValidationError("Malformed JSON body.");
    });

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new PublicApplicationValidationError(
        "Application must be a JSON object.",
      );
    }

    const service = new PublicApplicationService(getDatabasePool());
    const result = await service.submitPublicApplication(body, tenantId, clientIp);

    return NextResponse.json({ application: result }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error.";

    if (error instanceof PublicApplicationValidationError) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (error instanceof PublicApplicationRateLimitError) {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    if (
      message.includes("not found") ||
      message.includes("was not found") ||
      message.includes("does not belong")
    ) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    console.error("[public/apply POST] Unexpected error:", message);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
