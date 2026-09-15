# ADR-0027 — Platform-Admin Table RLS Strategy

**Date:** 2026-06-18  
**Status:** Accepted  
**Deciders:** Council Review IV (Agent 1 + synthesis)

---

## Context

The following platform-admin tables exist in the Supabase database and hold cross-tenant identity data:

- `academy_tenant_registry`
- `academy_platform_role_assignments`
- `academy_platform_user_preferences`
- `academy_platform_audit_events`
- `academy_student_number_sequences`
- `hq_sessions`

No RLS policies have been defined for any of these tables in any migration. All tenant-scoped tables (`academy_people`, `academy_course_sections`, etc.) have RLS enabled and include `tenant_id` filters. The platform-admin tables are exceptional because they are cross-tenant by design — they cannot use the standard `tenant_id = current_setting(...)` pattern.

The current protection is only at the API route layer (the `/platform/tenants` route verifies the actor is a platform admin). A misconfigured route, a direct Supabase client call, or a SQL injection could expose all tenant registry data without RLS as a safety net.

---

## Decision

**Platform-admin tables must be protected with explicit RLS policies that deny all access to `anon` and `authenticated` roles.** All reads and writes must flow through Postgres functions with `SECURITY DEFINER` or through the service-role key (not the anon/authenticated key).

Concrete policies for each table:

```sql
-- Deny all authenticated and anon access
alter table academy_tenant_registry enable row level security;
create policy "platform_admin_deny_all" on academy_tenant_registry
  as restrictive for all to authenticated, anon using (false);

-- Repeat for each platform-admin table
```

Service-role API routes (those that use `getDatabasePool()` with the service-role key) are unaffected — service role bypasses RLS by design. This change only closes the gap for clients using the anon or authenticated Supabase key.

---

## Consequences

- **Platform-admin API routes continue to work unchanged** — they use the service-role database pool.
- **Direct Supabase client access to these tables from the browser is blocked** — prevents accidental cross-tenant data exposure.
- **`hq_sessions` must be reviewed** — if it is accessed via the authenticated client anywhere, that call will break. If it is service-role only, no change needed.
- A migration must be created to add these policies before the next production deployment.

---

## Rejected Alternatives

- **Application-layer enforcement only** — insufficient; RLS is the database-enforced last line of defense.
- **Move platform-admin tables to a separate schema** — valid long-term but higher migration complexity; RLS policies are lower risk and immediately deployable.
