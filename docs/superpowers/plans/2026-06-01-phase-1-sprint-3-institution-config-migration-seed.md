# Phase 1 Sprint 3 Institution Configuration Migration And Seed Data Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex must use relevant Superpowers skills when they are available. GitHub Copilot, Claude Code, and similar tools can execute it through focused passes, subagents where available, or separate task sessions. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-scoped institution configuration persistence foundation through SQL migration, migration discovery, and seeded mock Academy data.

**Architecture:** Institution configuration remains owned by `src/modules/academy-config`. The persistence foundation stores the institution profile in `academy_institution_profiles` with JSONB subdocuments for supported modes, operating rules, capabilities, and LMS preference. Local migration execution now applies all SQL migration files in sorted order.

**Tech Stack:** TypeScript, Node `node:test`, Postgres SQL migrations, existing local migration and seed scripts.

---

## Factory Intake

Product area: Institution Configuration.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched:

- `academy_institution_profiles` schema
- seeded mock `institutionProfile`
- local migration discovery
- Academy data repository seed and load paths

LMS impact: stores provider preference as Academy configuration data only; no provider adapter behavior is introduced.

Student PWA impact: stores capability flags for future PWA work only.

ShepherdAI impact: stores capability flag and future context only; no signals are added.

Security/privacy impact: creates tenant-scoped institution profile storage. Future sprint must add API authorization and audit behavior before edits are exposed.

## Files

- Create: `src/lib/migrations.ts`
- Create: `supabase/migrations/20260601010000_academy_institution_config.sql`
- Create: `src/modules/academy-config/__tests__/institution-config-persistence.test.ts`
- Create: `docs/superpowers/plans/2026-06-01-phase-1-sprint-3-institution-config-migration-seed.md`
- Modify: `scripts/db-migrate-local.ts`
- Modify: `src/modules/academy-data/types.ts`
- Modify: `src/modules/academy-data/mock-data.ts`
- Modify: `src/modules/academy-data/postgres-repository.ts`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Tests

- [x] Add a test that local migration discovery includes the new institution config migration after the base Academy migration.
- [x] Add a test that the migration creates tenant-scoped institution profile storage.
- [x] Add a test that the seeded mock Academy dataset includes a valid institution profile.
- [x] Run the focused test command and observe failure because the migration helper does not exist.

RED command:

```bash
npm test -- src/modules/academy-config/__tests__/institution-config-persistence.test.ts
```

Observed failure:

```text
Error: Cannot find module '@/lib/migrations'
```

### Task 2: Migration Discovery

- [x] Add `src/lib/migrations.ts`.
- [x] Implement sorted SQL migration file discovery.
- [x] Update `scripts/db-migrate-local.ts` to apply every migration in order.

### Task 3: Institution Profile Migration

- [x] Add `academy_institution_profiles`.
- [x] Use `tenant_id` as primary key.
- [x] Store supported modes, operating rules, capabilities, and LMS preference as JSONB.
- [x] Add `updated_at` index for operational review.

### Task 4: Seed Data

- [x] Add `institutionProfile` to `AcademyDataset`.
- [x] Seed the mock dataset with a valid mixed ChurchCore Academy profile.
- [x] Update `AcademyDataRepository.seedFromMockData` to upsert the institution profile.
- [x] Update `AcademyDataRepository.loadDataset` to read the institution profile.

### Task 5: Verification

- [x] Run focused persistence test slice.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Scan migration and repository changes for placeholder text, stale college-only language, and accidental LMS runtime behavior.

## Review Boundary

This sprint is complete when the schema and seed foundation exists and is verified. It must not expose institution configuration through new API routes or UI, and it must not implement LMS provider behavior.

## Next Sprint

Phase 1 Sprint 4 should add the institution configuration repository and API read path, with authorization and tenant-boundary review before any write endpoints are introduced.
