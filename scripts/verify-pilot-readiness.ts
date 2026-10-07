import { readdir } from "node:fs/promises";
import { Pool } from "pg";
import {
  assessPilotEndpoint,
  describePendingMigrations,
  findPendingMigrations,
  sanitizedEndpoint,
} from "@/modules/acceptance/pilot-readiness";

const timeoutMs = 5_000;

async function main() {
  const skipApp = process.argv.includes("--skip-app");
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const databaseUrl = requiredEnv("DATABASE_URL");
  const academyUrl = process.env.CCA_PILOT_BASE_URL ?? "http://localhost:3200";

  const endpoints = [
    assessPilotEndpoint("CCA_PILOT_BASE_URL", academyUrl),
    assessPilotEndpoint("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    assessPilotEndpoint("DATABASE_URL", databaseUrl),
  ];
  await verifySupabaseAuth(supabaseUrl, publishableKey);
  await verifyDatabase(databaseUrl);
  if (!skipApp) await verifyAcademy(academyUrl);

  for (const endpoint of endpoints) {
    console.log(`[pilot readiness] ${endpoint.label}: ${sanitizedEndpoint(endpoint)} (${endpoint.classification})`);
  }
  console.log(`[pilot readiness] Supabase Auth: reachable`);
  console.log(`[pilot readiness] Postgres: reachable, all migrations applied`);
  console.log(`[pilot readiness] Academy login: ${skipApp ? "skipped" : "reachable"}`);
  console.log(`[pilot readiness] PASS — local/private topology only; no credentials printed`);
}

async function verifySupabaseAuth(baseUrl: string, publishableKey: string) {
  const response = await fetchWithTimeout(`${baseUrl.replace(/\/+$/, "")}/auth/v1/health`, {
    headers: { apikey: publishableKey },
  });
  if (!response.ok) throw new Error(`Supabase Auth health check failed with HTTP ${response.status}.`);
}

async function verifyDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: timeoutMs, max: 1 });
  try {
    await pool.query("select 1 as ready");
    const pending = findPendingMigrations(await readdir("supabase/migrations"), await appliedMigrationNames(pool));
    if (pending.length > 0) throw new Error(describePendingMigrations(pending));
  } finally {
    await pool.end();
  }
}

// Names from both trackers: db:migrate:local records file names; the Supabase CLI records
// version + name. Either tracker may be missing on a given database.
async function appliedMigrationNames(pool: Pool): Promise<string[]> {
  const names: string[] = [];
  const tables = await pool.query<{ repo: boolean; cli: boolean }>(
    `select to_regclass('public.schema_migrations') is not null as repo,
            to_regclass('supabase_migrations.schema_migrations') is not null as cli`,
  );
  const { repo, cli } = tables.rows[0] ?? { repo: false, cli: false };
  if (repo) {
    const rows = await pool.query<{ name: string }>("select name from public.schema_migrations");
    names.push(...rows.rows.map((row) => row.name));
  }
  if (cli) {
    const rows = await pool.query<{ file: string }>(
      "select version || '_' || name || '.sql' as file from supabase_migrations.schema_migrations where name is not null",
    );
    names.push(...rows.rows.map((row) => row.file));
  }
  return names;
}

async function verifyAcademy(baseUrl: string) {
  const response = await fetchWithTimeout(`${baseUrl.replace(/\/+$/, "")}/login`, { redirect: "manual" });
  if (!response.ok) throw new Error(`Academy login check failed with HTTP ${response.status}.`);
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

main().catch((error: unknown) => {
  console.error(`[pilot readiness] FAIL — ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exit(1);
});
