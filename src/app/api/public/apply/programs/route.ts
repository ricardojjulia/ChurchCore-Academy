import { getDatabasePool } from "@/lib/database";
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
    const tenantId = resolveTenantId(request);
    const pool = getDatabasePool();

    const result = await pool.query(
      `select id, title, description, credit_hours, clock_hours
       from academy_programs
       where tenant_id = $1 and status = 'active'
       order by title asc`,
      [tenantId],
    );

    const programs = result.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      description:
        row.description != null ? String(row.description) : undefined,
      creditHours:
        row.credit_hours != null ? Number(row.credit_hours) : undefined,
      clockHours:
        row.clock_hours != null ? Number(row.clock_hours) : undefined,
    }));

    return NextResponse.json({ programs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error.";
    console.error("[public/apply/programs GET] Unexpected error:", message);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
