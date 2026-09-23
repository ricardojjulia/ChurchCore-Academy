import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { E2E_PASSWORD, OTHER_TENANT_ID, PERSONAS, PRIMARY_TENANT_ID, type E2EPersona } from "../../e2e/personas";

// Idempotent seed for the disposable e2e database, run after migrations. Migrations already seed
// the demo tenant and most personas; this adds a login for every remaining AcademyRole and a
// second tenant so cross-tenant isolation can be tested in a real browser and over the API.

const databaseUrl = requireEnv("DATABASE_URL");
const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (see scripts/e2e/run.ts).`);
  return value;
}

function assertDisposableDatabase(url: string) {
  const { hostname, port } = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(hostname) || port === "56322") {
    throw new Error(`Refusing to seed ${hostname}:${port} — the e2e seed only runs against the disposable e2e database.`);
  }
}

async function ensureOtherTenant(pool: Pool) {
  await pool.query(
    `insert into academy_institution_profiles (
       tenant_id, institution_name, legal_name, primary_mode, supported_modes, operating_rules,
       capabilities, lms_preference, created_at, updated_at
     )
     select $1, 'E2E Other Institution', 'E2E Other Institution', primary_mode, supported_modes,
            operating_rules, capabilities, lms_preference, now(), now()
     from academy_institution_profiles where tenant_id = $2
     on conflict (tenant_id) do nothing`,
    [OTHER_TENANT_ID, PRIMARY_TENANT_ID],
  );
}

async function ensureAuthUser(admin: SupabaseClient, email: string): Promise<string> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const existing = data.users.find((user) => user.email?.toLowerCase() === email);
    if (existing) {
      await admin.auth.admin.updateUserById(existing.id, { password: E2E_PASSWORD, email_confirm: true });
      return existing.id;
    }
    if (data.users.length < 200) break;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password: E2E_PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error(`Could not create ${email}`);
  return data.user.id;
}

async function ensurePersona(pool: Pool, persona: E2EPersona, authUserId: string) {
  const slug = persona.personId.replace(/^person-/, "");
  const [given, ...rest] = slug.replace(/^e2e-/, "").split("-");
  const displayName = `E2E ${[given, ...rest].map((part) => part[0].toUpperCase() + part.slice(1)).join(" ")}`;

  await pool.query(
    `insert into academy_people (id, tenant_id, display_name, given_name, family_name, email, person_status, created_at, updated_at)
     values ($1, $2, $3, 'E2E', $4, $5, 'active', now(), now())
     on conflict (id) do update set email = excluded.email, person_status = 'active', updated_at = now()`,
    [persona.personId, persona.tenantId, displayName, displayName.replace(/^E2E /, ""), persona.email],
  );
  await pool.query(
    `insert into academy_staff_profiles (id, tenant_id, person_id, staff_number, title, primary_role, employment_status, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, 'active', now(), now())
     on conflict (id) do update set primary_role = excluded.primary_role, employment_status = 'active', updated_at = now()`,
    [`staff-${slug}`, persona.tenantId, persona.personId, `E2E-${slug.toUpperCase()}`, displayName, persona.role],
  );
  await pool.query(
    `insert into academy_account_links (id, tenant_id, person_id, provider, external_subject, status, created_at, updated_at)
     values ($1, $2, $3, 'supabase', $4, 'active', now(), now())
     on conflict (id) do update set external_subject = excluded.external_subject, status = 'active', updated_at = now()`,
    [`account-${slug}`, persona.tenantId, persona.personId, authUserId],
  );
  await pool.query(
    `insert into academy_person_role_assignments (id, tenant_id, person_id, role, scope_type, scope_id, status, starts_on, created_at, updated_at)
     values ($1, $2, $3, $4, 'tenant', null, 'active', current_date, now(), now())
     on conflict (id) do update set status = 'active', ends_on = null, updated_at = now()`,
    [`role-${slug}`, persona.tenantId, persona.personId, persona.role],
  );
}

async function main() {
  assertDisposableDatabase(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  try {
    await ensureOtherTenant(pool);
    for (const persona of Object.values(PERSONAS)) {
      if (persona.seeded !== "e2e") continue;
      const authUserId = await ensureAuthUser(admin, persona.email.toLowerCase());
      await ensurePersona(pool, persona, authUserId);
    }
    const { rows } = await pool.query("select count(*)::int as n from academy_account_links where status = 'active'");
    console.log(`[e2e seed] ok — ${rows[0].n} active account links, tenants ${PRIMARY_TENANT_ID} + ${OTHER_TENANT_ID}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[e2e seed] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
