# Release 1 Production Security Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace caller-controlled Academy identity with verified Supabase-session identity, enforce tenant isolation through Postgres RLS, add immutable audit records, and make production data access fail closed.

**Architecture:** A shared request-context resolver verifies the Supabase user and resolves Academy identity from persisted account links and active role assignments. Application policy checks remain in place, while a new append-only migration enables and forces RLS on every Academy table using database helper functions derived from JWT subject and persisted relationships. Runtime repositories may use seeded data only in explicit demo/test paths.

**Tech Stack:** Next.js App Router, TypeScript, Supabase SSR/Auth, PostgreSQL RLS, `pg`, node:test, ESLint.

---

## File Structure

- `src/modules/academy-auth/errors.ts`: typed authentication and authorization failures mapped to safe HTTP status codes.
- `src/modules/academy-auth/session-resolver.ts`: framework-independent Academy identity resolution from a verified external subject and repository.
- `src/modules/academy-auth/postgres-identity-repository.ts`: account-link and active-role lookup.
- `src/modules/academy-auth/request-context.ts`: Supabase session adapter plus tightly gated local bootstrap behavior.
- `src/modules/academy-auth/__tests__/session-resolver.test.ts`: identity, role, tenant, expiration, and header-impersonation tests.
- `src/app/api/academy/api-utils.ts`: safe status mapping for typed errors and validation/conflict failures.
- `src/app/api/academy/**/route.ts`: replace bootstrap resolver with verified session resolver.
- `supabase/migrations/20260613010000_academy_auth_rls_audit.sql`: auth helper functions, immutable audit table, RLS enablement, and policies.
- `src/modules/academy-auth/__tests__/security-migration.test.ts`: migration coverage for all Academy tables and policy requirements.
- `src/modules/audit/types.ts`: safe audit-event contract.
- `src/modules/audit/postgres-repository.ts`: append-only audit persistence.
- `src/modules/audit/__tests__/audit-repository.test.ts`: tenant scope and metadata redaction tests.
- `src/modules/academy-data/runtime-dataset.ts`: explicit runtime repository selection with no silent production fallback.
- `src/modules/academy-data/__tests__/runtime-dataset.test.ts`: production fail-closed and demo/test selection tests.
- `src/modules/scheduled-jobs/evaluate-academic-workflows.ts`: use runtime dataset loader without catch-to-mock behavior.
- `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/software-factory.md`, `docs/product/factory-roadmap.md`: actual Release 1 status and operational constraints.
- `docs/adr/0017-session-derived-academy-identity.md`: session identity decision.
- `docs/adr/0018-postgres-rls-and-request-database-context.md`: RLS decision.
- `docs/adr/0019-immutable-audit-events-and-outbox-boundary.md`: audit and future outbox decision.
- `docs/runbooks/academy-auth-and-tenant-access.md`: configuration, local bootstrap, access troubleshooting, and incident steps.

### Task 1: Session-Derived Academy Identity

**Files:**
- Create: `src/modules/academy-auth/errors.ts`
- Create: `src/modules/academy-auth/session-resolver.ts`
- Create: `src/modules/academy-auth/postgres-identity-repository.ts`
- Create: `src/modules/academy-auth/__tests__/session-resolver.test.ts`
- Modify: `src/modules/academy-auth/request-context.ts`
- Modify: `src/modules/academy-auth/__tests__/policy.test.ts`

- [ ] **Step 1: Write failing identity-resolution tests**

Cover:

```ts
test("resolves tenant and active roles from persisted account membership");
test("rejects an external subject with no Academy account link");
test("rejects inactive and expired role assignments");
test("rejects ambiguous active memberships across tenants");
test("ignores x-academy identity and role headers for session actors");
test("never defaults a missing role to institution_admin");
test("permits bootstrap headers only in explicit non-production local mode");
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --import tsx --test src/modules/academy-auth/__tests__/session-resolver.test.ts
```

Expected: fail because the session resolver and repository contracts do not exist.

- [ ] **Step 3: Implement typed failures and repository-independent resolution**

Define:

```ts
export class AcademyAuthenticationError extends Error {}
export class AcademyAuthorizationError extends Error {}

export interface AcademyIdentityRecord {
  externalSubject: string;
  personId: string;
  tenantId: string;
  roles: AcademyRole[];
}

export interface AcademyIdentityRepository {
  findActiveIdentities(externalSubject: string, asOf: string): Promise<AcademyIdentityRecord[]>;
}
```

The resolver must require exactly one active tenant identity and at least one active role.

- [ ] **Step 4: Implement the Postgres identity repository**

Query `academy_account_links`, `academy_people`, and `academy_person_role_assignments` by `provider = 'supabase'`, external subject, active statuses, and date-valid assignments. Do not accept tenant or role input from request headers.

- [ ] **Step 5: Replace request-context behavior**

`resolveAcademyActorFromSession()` must call `supabase.auth.getUser()`, pass `user.id` to the identity resolver, and return `source: "supabase_session"`.

Local bootstrap is a separate function and requires:

```ts
NODE_ENV !== "production"
ACADEMY_LOCAL_BOOTSTRAP_ENABLED === "true"
hostname in localhost, 127.0.0.1, or ::1
```

- [ ] **Step 6: Verify GREEN**

Run the focused auth tests and existing policy tests. Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/modules/academy-auth
git commit -m "feat(auth): derive Academy identity from verified sessions"
```

### Task 2: Safe API Error Mapping And Route Conversion

**Files:**
- Modify: `src/app/api/academy/api-utils.ts`
- Create: `src/app/api/academy/__tests__/api-utils.test.ts`
- Modify: all Academy API route handlers currently importing `resolveBootstrapAcademyActor`
- Modify: `src/modules/academy-auth/platform-request-context.ts`
- Test: existing route tests plus new request-context route tests

- [ ] **Step 1: Write failing error-mapping and route-authentication tests**

Assert:

- authentication errors return `401`;
- authorization errors return `403`;
- malformed input returns `400`;
- conflicts return `409`;
- unknown persistence failures return generic `500`;
- `x-academy-roles: institution_admin` cannot grant access without a session;
- platform roles cannot be granted by request headers.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --import tsx --test src/app/api/academy/__tests__/api-utils.test.ts
```

- [ ] **Step 3: Implement safe error mapping**

Do not return raw database or provider error messages. Map only known typed errors and known domain-safe validation messages.

- [ ] **Step 4: Convert routes**

Replace each `resolveBootstrapAcademyActor(request.headers)` call with:

```ts
const { actor } = await resolveAcademyActorFromSession(request);
```

Convert platform routes to verified session metadata only. Preserve helper functions that accept an `AcademyActor` so domain tests remain framework independent.

- [ ] **Step 5: Run all API route tests**

Run:

```bash
node --import tsx --test "src/app/api/academy/**/*.test.ts"
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/academy src/modules/academy-auth
git commit -m "feat(auth): require verified sessions on Academy APIs"
```

### Task 3: RLS And Immutable Audit Migration

**Files:**
- Create: `supabase/migrations/20260613010000_academy_auth_rls_audit.sql`
- Create: `src/modules/academy-auth/__tests__/security-migration.test.ts`
- Modify: `src/lib/migrations.ts` only if migration discovery needs new validation

- [ ] **Step 1: Write the failing migration test**

The test must discover every `academy_*`, `ai_*`, `workflows`, `workflow_actions`, and `workflow_feedback` table created by earlier migrations and assert the security migration contains:

- `enable row level security`;
- `force row level security`;
- an applicable policy;
- auth helper functions with fixed `search_path`;
- append-only audit protections.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --import tsx --test src/modules/academy-auth/__tests__/security-migration.test.ts
```

- [ ] **Step 3: Implement auth helper functions**

Create stable SQL helpers for:

```sql
academy_current_external_subject()
academy_current_person_id()
academy_current_tenant_ids()
academy_has_active_role(p_tenant_id text, p_roles text[])
academy_can_read_student(p_tenant_id text, p_student_person_id text)
```

Use `auth.uid()` or JWT `sub`, persisted account links, active role dates, and active guardian relationships.

- [ ] **Step 4: Create immutable audit storage**

Create `academy_audit_events` with tenant, actor, action, entity references, correlation/idempotency keys, redacted metadata, and timestamp. Reject update and delete through privileges, RLS, and a defensive trigger.

- [ ] **Step 5: Enable and force RLS**

Apply least-privilege policies by table family:

- tenant configuration and academic setup: authorized staff roles;
- people records: administrative staff plus self/guardian scoped reads;
- grades and official records: registrar/academic staff plus released self/guardian reads;
- workflows and suggestions: academic administrators;
- audit records: authorized administrators, read only;
- demo feedback: preserve platform-only policies.

- [ ] **Step 6: Verify migration tests and apply in a transaction**

Run:

```bash
node --import tsx --test src/modules/academy-auth/__tests__/security-migration.test.ts
npm run db:migrate:local
```

Expected: test pass and migration application succeeds against configured local Postgres. If local Postgres is unavailable, record that verification gap explicitly.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260613010000_academy_auth_rls_audit.sql src/modules/academy-auth/__tests__/security-migration.test.ts
git commit -m "feat(db): enforce Academy tenant isolation with RLS"
```

### Task 4: Request-Scoped Database Context

**Files:**
- Create: `src/lib/academy-database-context.ts`
- Create: `src/lib/academy-database-context.test.ts`
- Modify: request-facing Postgres repositories under `src/modules/**/postgres-repository.ts`

- [ ] **Step 1: Write failing transaction-context tests**

Assert that repository callbacks execute after:

```sql
select set_config('request.jwt.claim.sub', $1, true)
select set_config('app.academy_tenant_id', $2, true)
select set_config('app.academy_person_id', $3, true)
```

and that the transaction rolls back and releases the client on failure.

- [ ] **Step 2: Verify RED**

Run the focused test and confirm the helper is missing.

- [ ] **Step 3: Implement `withAcademyDatabaseContext`**

The helper accepts a verified actor and callback, starts a transaction, applies local settings, invokes the callback with the scoped client, commits on success, and rolls back on failure.

- [ ] **Step 4: Convert request-facing repositories**

Repository public methods accept either a scoped query client or are invoked inside the request context. Background jobs must pass an explicit tenant and use a separately named worker helper.

- [ ] **Step 5: Verify GREEN and repository tests**

Run all repository tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib src/modules
git commit -m "feat(db): add request-scoped Academy database context"
```

### Task 5: Audit Repository

**Files:**
- Create: `src/modules/audit/types.ts`
- Create: `src/modules/audit/postgres-repository.ts`
- Create: `src/modules/audit/__tests__/audit-repository.test.ts`

- [ ] **Step 1: Write failing audit tests**

Cover tenant matching, actor identity, correlation/idempotency keys, metadata redaction, append-only inserts, and rejection of secret-shaped metadata keys.

- [ ] **Step 2: Verify RED**

Run the focused test.

- [ ] **Step 3: Implement minimal audit types and repository**

Allowed metadata must be a small JSON object with no keys matching `token`, `secret`, `password`, `authorization`, `raw`, or `payload`.

- [ ] **Step 4: Verify GREEN**

Run focused audit tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules/audit
git commit -m "feat(audit): add immutable Academy audit events"
```

### Task 6: Remove Silent Mock Fallbacks

**Files:**
- Create: `src/modules/academy-data/runtime-dataset.ts`
- Create: `src/modules/academy-data/__tests__/runtime-dataset.test.ts`
- Modify: `src/modules/scheduled-jobs/evaluate-academic-workflows.ts`
- Modify: `src/modules/student-pwa/bootstrap-dashboard.ts`
- Modify: mock-backed page loaders identified by `rg "academyDataset|mock-data" src/app src/components`

- [ ] **Step 1: Write failing runtime-source tests**

Assert:

- production requires persistence;
- database errors propagate safely;
- explicit demo mode can select demo data;
- unit tests can inject in-memory data;
- no production code catches database errors and returns `academyDataset`.

- [ ] **Step 2: Verify RED**

Run the focused test.

- [ ] **Step 3: Implement explicit runtime source selection**

Use:

```ts
type AcademyRuntimeMode = "persistent" | "demo";
```

`demo` requires both demo flags and non-production deployment. `persistent` requires `DATABASE_URL`.

- [ ] **Step 4: Convert loaders**

Remove catch-to-mock behavior. Pages must show authenticated empty/error states when data is absent, not seeded student information.

- [ ] **Step 5: Verify GREEN**

Run runtime-source, scheduled-job, and Student PWA tests.

- [ ] **Step 6: Commit**

```bash
git add src/modules/academy-data src/modules/scheduled-jobs src/modules/student-pwa src/app src/components
git commit -m "fix(data): fail closed instead of serving mock Academy records"
```

### Task 7: ADRs, Runbook, And Status Documentation

**Files:**
- Create: `docs/adr/0017-session-derived-academy-identity.md`
- Create: `docs/adr/0018-postgres-rls-and-request-database-context.md`
- Create: `docs/adr/0019-immutable-audit-events-and-outbox-boundary.md`
- Create: `docs/runbooks/academy-auth-and-tenant-access.md`
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/architecture.md`
- Modify: `docs/software-factory.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/product/faith-based-academy-master-plan.md`

- [ ] **Step 1: Write accepted ADRs**

Document the verified-session identity, RLS/request context, and immutable audit/outbox decisions, including alternatives, consequences, rollback, and testing.

- [ ] **Step 2: Write the auth/tenant runbook**

Include environment variables, Supabase account linking, role assignment, local bootstrap restrictions, RLS troubleshooting, audit inspection, access revocation, and incident response.

- [ ] **Step 3: Correct roadmap and README drift**

State separately:

- implemented and verified;
- implemented but not production-verified;
- planned;
- blocked by external credentials/certification.

Do not describe later releases as complete.

- [ ] **Step 4: Verify documentation**

Run:

```bash
rg -n "x-academy-|default.*institution_admin|mock fallback|Canvas adapter design package" README.md CLAUDE.md docs
git diff --check
```

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md docs
git commit -m "docs: define Academy security operations and release status"
```

### Task 8: Release 1 Verification And Review

**Files:**
- Modify: this plan to check completed tasks and record verification evidence
- Create: `docs/superpowers/plans/2026-06-13-release-1-security-verification.md`

- [x] **Step 1: Run the full gate**

```bash
npm test
npm run lint
npm run build
git diff --check
npm audit
```

- [x] **Step 2: Run database verification**

Apply migrations to local Supabase/Postgres, then test authenticated tenant A, tenant B, student, guardian, staff, and unauthenticated database claims.

- [x] **Step 3: Run browser verification**

Verify login requirements and allowed/denied states for administrator, academic staff, student, guardian, and platform staff routes.

- [x] **Step 4: Conduct security review**

Review the branch for:

- caller-controlled identity;
- service-role use in requests;
- missing RLS;
- mock fallback;
- raw errors or secrets;
- cross-tenant queries;
- audit mutation paths.

- [x] **Step 5: Record residual risks**

The release cannot be marked production-ready while high-severity dependency findings remain unresolved or the supported Node runtime does not satisfy declared package engines.

- [x] **Step 6: Commit verification evidence**

```bash
git add docs/superpowers/plans
git commit -m "docs: record Release 1 security verification"
```

Closeout evidence is recorded in:

- `docs/superpowers/plans/2026-06-13-release-1-security-verification.md`
- `docs/reviews/2026-06-20-release-1-security-exit-gate-closeout.md`
