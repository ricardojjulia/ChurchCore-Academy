import { getDatabasePool } from "@/lib/database";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface PublicInstitutionResolverDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

export class PublicInstitutionNotFoundError extends Error {
  constructor(message = "Institution was not found.") {
    super(message);
    this.name = "PublicInstitutionNotFoundError";
  }
}

function normalizeHost(value: string | null): string | undefined {
  const firstHost = value?.split(",")[0]?.trim().toLowerCase();
  if (!firstHost) return undefined;
  return firstHost.replace(/:\d+$/, "");
}

function normalizeSlug(value: string | null): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return undefined;
  return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(trimmed)
    ? trimmed
    : undefined;
}

function getRequestHost(request: Request): string | undefined {
  return (
    normalizeHost(request.headers.get("host")) ??
    normalizeHost(new URL(request.url).host) ??
    normalizeHost(request.headers.get("x-forwarded-host"))
  );
}

export async function resolvePublicInstitutionTenant(
  request: Request,
  database: PublicInstitutionResolverDatabase = getDatabasePool(),
): Promise<string> {
  const url = new URL(request.url);
  const host = getRequestHost(request);
  const slug = normalizeSlug(
    url.searchParams.get("institution") ?? url.searchParams.get("school"),
  );

  const result = await database.query(
    `select tenant_id
     from academy_public_institution_routes
     where published_at is not null
       and (
         (route_type = 'host' and route_value = $1)
         or (route_type = 'slug' and route_value = $2)
       )
     order by case when route_type = 'host' then 0 else 1 end
     limit 1`,
    [host ?? "", slug ?? ""],
  );

  const tenantId = result.rows[0]?.tenant_id;
  if (!tenantId) {
    throw new PublicInstitutionNotFoundError();
  }

  return String(tenantId);
}
