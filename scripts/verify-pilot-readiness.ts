import { Pool } from "pg";
import {
  assessPilotEndpoint,
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
  console.log(`[pilot readiness] Postgres: reachable`);
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
  } finally {
    await pool.end();
  }
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
