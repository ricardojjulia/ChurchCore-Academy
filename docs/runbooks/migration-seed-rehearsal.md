# Migration Seed Rehearsal Runbook

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`

## Purpose

Use this runbook to prove a local or pilot database can be migrated, seeded, and checked before deployment readiness is claimed.

## Required Environment

- `DATABASE_URL` points to the intended local or rehearsal Postgres database.
- `.env.local` is present for local runs.
- The database is not a production official-record database unless a separate production change window has been approved.
- Optional: `ACADEMY_REHEARSAL_TENANT_ID`; defaults to `cca-main`.

## Standard Rehearsal

```bash
npm run db:migrate:local
npm run db:seed:local
npm run verify:migration-seed-rehearsal
```

Expected result:

- migrations apply or skip as already tracked;
- `public.schema_migrations` has one row for every local migration file;
- default tenant seed counts meet the minimum pilot/demo threshold;
- runtime source-boundary scan reports no seeded dataset imports.

## Verification Bundle

```bash
node --import tsx --test src/modules/acceptance/__tests__/migration-seed-rehearsal.test.ts src/modules/academy-data/__tests__/runtime-source-boundary.test.ts
npm test
npm run lint
npm run build
git diff --check
```

## Failed Migration Recovery

1. Stop the application process using the failed database.
2. Preserve the terminal output, migration name, timestamp, and database URL target.
3. Do not edit an already-committed migration after it has been shared.
4. If the failed migration was not recorded in `public.schema_migrations`, fix the SQL in a new forward migration or rerun the same uncommitted local migration after review.
5. If the failed migration was partially applied, write a forward repair migration that makes the intended state explicit and idempotent.
6. Rerun:

```bash
npm run db:migrate:local
npm run verify:migration-seed-rehearsal
```

7. Run the full verification bundle before opening or merging a PR.

## Seed Data Recovery

If seed checks fail:

1. Confirm `DATABASE_URL` points to the rehearsal database.
2. Run `npm run db:seed:local`.
3. If counts still fail, inspect the specific table named by the verifier.
4. Add or repair seed data with a forward migration or deterministic repository seed update.
5. Rerun the standard rehearsal.

## Runtime Source Boundary Recovery

If the verifier reports runtime imports of `mock-data` or `server-dataset`:

1. Replace the import with `requireActor()` plus targeted database reads, or a domain service using request-scoped database context.
2. Keep seeded datasets limited to tests, local seed commands, and explicit non-runtime fixtures.
3. Rerun the source-boundary tests and the rehearsal verifier.

## Release Notes

This runbook proves local rehearsal readiness only. Hosted Supabase deployment, backup/restore, provider activation, monitoring, and incident response are handled by later ADR-0038 runbooks.
