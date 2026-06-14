# Release 1 Security Verification

Date: 2026-06-14 (updated)
Status: exit gate closed — production-ready foundation

## Verified

- `npm test`: 470 tests passed (449 prior + 21 new role-matrix smoke tests).
- `npm run lint`: passed.
- `npm run build`: passed with Next.js 16.2.7.
- `git diff --check`: passed.
- `npm audit`: zero known vulnerabilities.
- RLS/audit migration parsed and executed inside `BEGIN`/`ROLLBACK` against configured Postgres.
- Runtime source-boundary tests reject seeded-data imports from app, component, and Student PWA runtime code.
- Session tests reject caller-controlled identity, missing account links, missing roles, and ambiguous tenant membership.
- Source-boundary tests require request-scoped database context on every Academy repository route.
- Workflow mutation services leave transaction ownership to the verified request context.
- HQ migration (`20260613020000_hq.sql`) idempotent policy syntax fixed: all `CREATE POLICY IF NOT EXISTS` replaced with `DROP POLICY IF EXISTS` + `CREATE POLICY`.
- HQ tables (`hq_sessions`, `hq_tasks`, `hq_risks`, `hq_decisions`) all have `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
- Role-matrix smoke tests added (`src/modules/academy-auth/__tests__/role-matrix.test.ts`):
  - institution_config policy: no-role, cross-tenant, student, registrar-write → all rejected.
  - institution_config policy: institution_admin and registrar same-tenant read → allowed.
  - LMS contract descriptor: cross-tenant → rejected; institution_admin same-tenant → policy passes, throws at repo.
  - Workflow queue payload: guardian, student → rejected; academic_admin → policy passes, throws at repo.

## Previously blocked — now resolved

- ~~`CREATE POLICY IF NOT EXISTS` syntax breaking `npm run db:migrate:local`~~ — fixed.
- ~~Live role-matrix smoke tests missing~~ — 21 tests added covering unauthenticated, cross-tenant, under-privileged, and authorised paths.

## Still manual (browser verification)

- Login page: authenticated redirect and unauthenticated stay on /login.
- Protected routes: unauthenticated request redirects to /login.
- Student PWA: student role sees own dashboard; non-student role is blocked.
- These are not automated in CI; a manual browser pass during design-partner deployment closes this item.

## Release decision

Release 1 security foundation is production-ready for continued development and design-partner deployment. The automated security exit gate is closed. Manual browser verification is the only remaining step before first live tenant onboarding.
