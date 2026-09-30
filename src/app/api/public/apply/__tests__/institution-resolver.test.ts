import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  PublicInstitutionNotFoundError,
  resolvePublicInstitutionTenant,
  type PublicInstitutionResolverDatabase,
} from "@/app/api/public/apply/institution-resolver";

function databaseReturning(
  rows: Record<string, unknown>[],
  calls: { sql: string; values?: unknown[] }[] = [],
): PublicInstitutionResolverDatabase {
  return {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rowCount: rows.length, rows };
    },
  };
}

test("public institution resolver uses a published host mapping and ignores tenant query input", async () => {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const request = new Request(
    "https://academy.example.org/apply?tenant=attacker-tenant",
    {
      headers: { "x-forwarded-host": "attacker.example.org" },
    },
  );

  const tenantId = await resolvePublicInstitutionTenant(
    request,
    databaseReturning([{ tenant_id: "tenant-academy" }], calls),
  );

  assert.equal(tenantId, "tenant-academy");
  assert.deepEqual(calls[0]?.values, ["academy.example.org", ""]);
  assert.match(calls[0]?.sql ?? "", /published_at is not null/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /searchParams|get\("tenant"\)/);
});

test("public institution resolver accepts a published institution slug when no host mapping matches", async () => {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const request = new Request(
    "https://apply.churchcore.test/apply?institution=ChurchCore-Academy",
  );

  const tenantId = await resolvePublicInstitutionTenant(
    request,
    databaseReturning([{ tenant_id: "cca-main" }], calls),
  );

  assert.equal(tenantId, "cca-main");
  assert.deepEqual(calls[0]?.values, ["apply.churchcore.test", "churchcore-academy"]);
});

test("public institution resolver rejects unknown or unpublished institutions", async () => {
  const request = new Request("https://unknown.example/apply?institution=missing");

  await assert.rejects(
    () => resolvePublicInstitutionTenant(request, databaseReturning([])),
    PublicInstitutionNotFoundError,
  );
});

test("public institution route migration creates published host and slug mappings", async () => {
  const sql = await readFile(
    join(
      process.cwd(),
      "supabase/migrations/20260929090000_public_institution_routes.sql",
    ),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.academy_public_institution_routes/);
  assert.match(sql, /route_type text not null check \(route_type in \('host', 'slug'\)\)/);
  assert.match(sql, /academy_public_institution_routes_value_normalized_check/);
  assert.match(sql, /route_value = lower\(trim\(route_value\)\)/);
  assert.match(sql, /route_value !~ ':\[0-9\]\+\$'/);
  assert.match(sql, /where published_at is not null/);
  assert.match(sql, /alter table public\.academy_public_institution_routes force row level security/);
  assert.match(sql, /revoke all on public\.academy_public_institution_routes from anon/);
  assert.match(sql, /revoke all on public\.academy_public_institution_routes from authenticated/);
  assert.match(sql, /\('cca-main', 'host', 'localhost', now\(\)\)/);
  assert.match(sql, /\('cca-main', 'host', '127\.0\.0\.1', now\(\)\)/);
  assert.match(sql, /\('cca-main', 'slug', 'churchcore-academy', now\(\)\)/);
});
