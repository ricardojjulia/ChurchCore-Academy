import { isIP } from "node:net";

export interface PilotEndpointAssessment {
  label: string;
  url: URL;
  classification: "loopback" | "private-network";
}

export function assessPilotEndpoint(label: string, rawValue: string): PilotEndpointAssessment {
  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  const hostname = url.hostname.toLowerCase();
  if (isLoopbackHost(hostname)) {
    return { label, url, classification: "loopback" };
  }
  if (isPrivateNetworkHost(hostname)) {
    return { label, url, classification: "private-network" };
  }
  throw new Error(`${label} must use loopback or a private-network IP address for a local pilot session.`);
}

export function sanitizedEndpoint(endpoint: PilotEndpointAssessment) {
  return `${endpoint.url.protocol}//${endpoint.url.host}`;
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "::1" || hostname === "[::1]" || hostname.startsWith("127.");
}

function isPrivateNetworkHost(hostname: string) {
  if (isIP(hostname) !== 4) return false;
  const [first, second] = hostname.split(".").map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

/**
 * Migration files the database has not recorded as applied. A migration counts as applied when
 * either the repo's `db:migrate:local` tracking (`public.schema_migrations.name`, the file name)
 * or the Supabase CLI (`supabase_migrations.schema_migrations`, `<version>_<name>.sql`) recorded
 * it. The 2026-10-06 dry run found a local DB 12 migrations behind while readiness still passed.
 */
export function findPendingMigrations(migrationFiles: readonly string[], appliedNames: Iterable<string>): string[] {
  const applied = new Set(appliedNames);
  return migrationFiles
    .filter((file) => file.endsWith(".sql"))
    .filter((file) => !applied.has(file))
    .sort();
}

/** One-line failure for pending migrations: the count, the first few names, and the fix. */
export function describePendingMigrations(pending: readonly string[], shown = 3): string {
  const listed = pending.slice(0, shown).join(", ");
  const more = pending.length > shown ? `, and ${pending.length - shown} more` : "";
  return `${pending.length} migration(s) not applied to the database (${listed}${more}). Run npm run db:migrate:local.`;
}
