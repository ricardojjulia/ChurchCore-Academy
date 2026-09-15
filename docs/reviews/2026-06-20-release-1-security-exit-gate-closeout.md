# Release 1 Security Exit Gate Closeout

Date: 2026-06-20

## Decision

Close the Release 1 production security exit gate for the authentication,
tenant-isolation, request-scoped RLS, immutable audit, and seeded-runtime-data
foundation.

This does not approve ChurchCore Academy as a complete production SIS. Later
Release 2+ workflows still require their own live policy, browser role-matrix,
operations, and domain acceptance gates before production tenant onboarding.

## Scope Closed

- Supabase sessions are resolved through verified server-side session reads.
- Academy identity is derived from persisted account links and active role
  assignments, not caller-controlled headers or editable metadata.
- Request-facing Academy reads and mutations run inside
  `withAcademyDatabaseContext`, setting tenant and person context for RLS.
- Academy-owned tables are protected by forced RLS migrations and tenant-aware
  constraints.
- Runtime admin surfaces no longer load the legacy full seeded Academy dataset.
- `loadProtectedAcademyDataset` is deprecated and new runtime imports are
  blocked by ESLint.

## Evidence

- `docs/superpowers/plans/2026-06-13-release-1-security-verification.md`
- `docs/adr/0017-session-derived-academy-identity.md`
- `docs/adr/0030-legacy-dataset-deprecation-strategy.md`
- `docs/adr/0031-workflow-evaluator-invocation-pattern.md`
- `src/modules/academy-auth/__tests__/session-resolver.test.ts`
- `src/modules/academy-auth/__tests__/request-database-boundary.test.ts`
- `src/modules/academy-auth/__tests__/role-matrix.test.ts`
- `src/modules/academy-data/__tests__/legacy-dataset-import-gate.test.ts`
- `src/app/__tests__/working-surface-pages.test.ts`

## Current Slice Verification

Run from repository root:

```bash
npm test
npm run lint
npm run build
npm audit --audit-level=high
git diff --check
```

Fresh verification on this slice:

- `npm test -- src/app/__tests__/working-surface-pages.test.ts src/modules/academy-data/__tests__/legacy-dataset-import-gate.test.ts`: 575 passing tests, 0 failures
- `npm run lint`: exit 0
- `npm run build`: exit 0
- `npm audit --audit-level=high`: 0 vulnerabilities
- `git diff --check`: exit 0

## Residual Risks

- Browser role-matrix acceptance is still required for each new Release 2+
  workflow surface.
- Production tenant onboarding still needs operations readiness: monitoring,
  backups, incident response, and tenant-specific data migration rehearsal.
- Full SIS production approval remains blocked by the product roadmap items in
  `docs/project-status.md`.
