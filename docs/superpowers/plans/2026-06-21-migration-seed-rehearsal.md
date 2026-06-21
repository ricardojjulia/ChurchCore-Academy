# Migration Seed Rehearsal Plan

Date: 2026-06-21  
Spec: `docs/superpowers/specs/2026-06-21-migration-seed-rehearsal-design.md`  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`

## Objective

Implement ADR-0038 Prompt 2 by proving the database can be migrated, seeded, and checked for a deterministic pilot/demo tenant.

## Tasks

- [x] Read ADR-0038 Prompt 2 and the Supabase/database operating guidance.
- [x] Inspect local migration and seed scripts.
- [x] Add a forward migration aligning finance RLS with the ADR-0038 role matrix.
- [x] Add `scripts/verify-migration-seed-rehearsal.ts`.
- [x] Add `npm run verify:migration-seed-rehearsal`.
- [x] Harden runtime source-boundary tests against `mock-data` and `server-dataset` imports.
- [x] Add `docs/runbooks/migration-seed-rehearsal.md`.
- [x] Run `npm run db:migrate:local`.
- [x] Run `npm run db:seed:local`.
- [x] Run `npm run verify:migration-seed-rehearsal`.
- [x] Run focused migration/source-boundary tests.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Acceptance Criteria

- All local migration files are represented in `public.schema_migrations`.
- The default rehearsal tenant `cca-main` has deterministic minimum data for institution, people, roles, programs, sections, students, registrations, attendance, and transcript issuance.
- Runtime source roots do not import deprecated seeded datasets.
- Finance role RLS matches service-layer authorization for billing, financial aid, and communications.
- Recovery steps for failed migrations are documented.

## Evidence Commands

```bash
npm run db:migrate:local
npm run db:seed:local
npm run verify:migration-seed-rehearsal
node --import tsx --test src/modules/acceptance/__tests__/migration-seed-rehearsal.test.ts src/modules/academy-data/__tests__/runtime-source-boundary.test.ts
npm test
npm run lint
npm run build
```
