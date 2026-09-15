# Migration Seed Rehearsal Design

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`  
Factory: `docs/software-factory.md`

## Factory Intake

ADR-0038 Prompt 2 requires proof that ChurchCore Academy can be migrated, seeded, and rehearsed for a controlled pilot tenant before deployment readiness can be claimed.

## Problem

The project has many domain migrations and deterministic demo data, but the acceptance program needs one repeatable rehearsal gate that verifies:

- local migration replay;
- applied migration tracking;
- deterministic pilot/demo tenant seed data;
- no runtime fallback to deprecated seeded datasets;
- failed-migration recovery steps.

## Decision

Add a non-mutating rehearsal verifier:

```bash
npm run verify:migration-seed-rehearsal
```

The verifier runs after `npm run db:migrate:local` and `npm run db:seed:local`. It checks `public.schema_migrations`, validates minimum deterministic rows for `cca-main`, and scans runtime source roots for forbidden `mock-data` and `server-dataset` imports.

## Finance RLS Alignment

ADR-0038 Prompt 1 made `finance` a first-class role. During Prompt 2 discovery, the database RLS policies for billing, aid, and finance communications were found to be missing `finance`. A forward migration updates those policies so service-level authorization and database enforcement match.

## Rehearsal Tenant

Default tenant: `cca-main`  
Override: `ACADEMY_REHEARSAL_TENANT_ID=<tenant-id>`

The default tenant remains a controlled demo/pilot rehearsal tenant. It is not production official-record evidence.

## Acceptance Boundary

This slice proves local migration and seed readiness. It does not prove live hosted Supabase deployment, provider credentials, backups, or production rollback. Those remain in ADR-0038 Prompts 3 and 4.

## Verification

- `npm run db:migrate:local`
- `npm run db:seed:local`
- `npm run verify:migration-seed-rehearsal`
- `node --import tsx --test src/modules/acceptance/__tests__/migration-seed-rehearsal.test.ts src/modules/academy-data/__tests__/runtime-source-boundary.test.ts`
- `npm test`
- `npm run lint`
- `npm run build`
