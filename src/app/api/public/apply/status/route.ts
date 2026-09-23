import { getDatabasePool } from "@/lib/database";
import {
  PublicApplicationService,
  PublicApplicationNotFoundError,
  PublicApplicationRateLimitError,
} from "@/modules/admissions/public-application-service";
import { NextResponse } from "next/server";

function resolveTenantId(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("tenant");
  if (fromQuery) return fromQuery;
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
    const service = new PublicApplicationService(getDatabasePool());
    const result = await service.checkApplicationStatus(tenantId, statusToken, getClientIp(request));

    return NextResponse.json({ status: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error.";

    if (error instanceof PublicApplicationNotFoundError) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (error instanceof PublicApplicationRateLimitError) {
      return NextResponse.json({ error: message }, { status: 429 });
    }

    console.error("[public/apply/status GET] Unexpected error:", message);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
