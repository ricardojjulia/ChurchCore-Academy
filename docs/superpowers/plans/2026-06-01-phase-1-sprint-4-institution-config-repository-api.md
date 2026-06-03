# Phase 1 Sprint 4 Institution Configuration Repository And API Read Path Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex must use relevant Superpowers skills when they are available. GitHub Copilot, Claude Code, and similar tools can execute it through focused passes, subagents where available, or separate task sessions. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only institution configuration repository and API payload path for the seeded Academy tenant.

**Architecture:** `src/modules/academy-config/postgres-repository.ts` owns Postgres row mapping and tenant-scoped profile reads. `src/app/api/academy/config/institution/route.ts` exposes a read-only GET payload for the current seeded tenant and returns validation warnings. No write endpoint, auth system, LMS adapter behavior, UI, or ShepherdAI runtime changes are introduced.

**Tech Stack:** TypeScript, Next.js App Router route handlers, Postgres repository pattern, Node `node:test`.

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

- read-only `academy_institution_profiles`

LMS impact: exposes stored LMS preference and capability flags only; no provider behavior is implemented.

Student PWA impact: exposes stored PWA capability flags only; no PWA route is implemented.

ShepherdAI impact: exposes stored recommendation capability only; no signals are added.

Security/privacy impact: no write endpoint is added. The API GET uses the seeded local tenant until authenticated tenant resolution exists. Repository method remains tenant-scoped for future authenticated use.

## Files

- Create: `src/modules/academy-config/postgres-repository.ts`
- Create: `src/app/api/academy/config/institution/route.ts`
- Create: `src/modules/academy-config/__tests__/institution-config-repository.test.ts`
- Create: `docs/superpowers/plans/2026-06-01-phase-1-sprint-4-institution-config-repository-api.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`
- Modify: `docs/software-factory.md`

## Tasks

### Task 1: Failing Tests

- [x] Add mapper test for institution profile rows.
- [x] Add tenant-scoped repository query test.
- [x] Add not-found repository test.
- [x] Add API payload builder test.
- [x] Run the focused test command and observe failure because the route/repository does not exist.

RED command:

```bash
npm test -- src/modules/academy-config/__tests__/institution-config-repository.test.ts
```

Observed failure:

```text
Error: Cannot find module '@/app/api/academy/config/institution/route'
```

### Task 2: Repository

- [x] Add `mapInstitutionProfileRow`.
- [x] Add `AcademyConfigRepository`.
- [x] Query `academy_institution_profiles` by `tenant_id = $1`.
- [x] Throw a not-found error when the tenant profile is missing.

### Task 3: API Read Path

- [x] Add `buildInstitutionConfigPayload`.
- [x] Return `institutionProfile`.
- [x] Return validation warnings from `validateInstitutionProfile`.
- [x] Add read-only GET route for the seeded local tenant.
- [x] Avoid arbitrary tenant selection until authenticated tenant resolution exists.

### Task 4: Documentation

- [x] Mark Phase 1 Sprint 4 as complete in the factory roadmap.
- [x] Mark the repository/API read path as complete in the master implementation plan.
- [x] Add the Sprint 4 plan to software factory knowledge references.

### Task 5: Verification

- [x] Run focused repository/API test slice.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Scan repository/API changes for placeholders, stale college-only language, accidental LMS runtime behavior, and unauthenticated write behavior.

## Review Boundary

This sprint is complete when the read-only repository and API payload path are verified. It must not add write endpoints, admin UI, PWA UI, LMS provider behavior, or ShepherdAI runtime changes.

## Next Sprint

Phase 1 Sprint 5 should add the admin review UI for institution configuration, using this read path and keeping write/edit behavior out of scope unless auth is added first.
