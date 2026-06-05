# Phase 7 Sprint 4 Tenant Provider Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve each tenant's LMS preference into a provider-neutral LMS context, descriptor, capability gate, and concrete no-LMS provider when applicable.

**Architecture:** This sprint adds a tenant provider resolver under `src/modules/lms-contract/`. The resolver reads the existing institution LMS preference, enforces tenant isolation, maps selection state to provider configuration state, gates capabilities for planned/paused/migration-required providers, and attaches only the no-LMS provider implementation for `none`. Moodle and Canvas remain descriptor-only until adapter phases.

**Tech Stack:** TypeScript, node:test, existing Next.js verification commands.

---

## Factory Intake

- Product area: LMS provider contract and tenant provider selection.
- Institution modes: all supported institution modes.
- Data touched: pure TypeScript resolver and tests.
- Student PWA impact: future launch flows can resolve the tenant provider without provider-secret exposure; no Student PWA route or UI change is added.
- LMS impact: resolves no-LMS, Moodle, and Canvas provider selections without adding Moodle or Canvas adapter runtime behavior.
- Security/privacy: tenant isolation and provider-secret exclusion are tested. No credential storage, provider network calls, migrations, API routes, webhooks, background jobs, or UI files are added.

## Files

- Create: `src/modules/lms-contract/tenant-provider-selection.ts`
- Create: `src/modules/lms-contract/__tests__/tenant-provider-selection.test.ts`
- Create: `docs/superpowers/plans/2026-06-04-phase-7-sprint-4-tenant-provider-selection.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: Tenant Provider Selection Tests

- [x] Write failing tests that require a tenant provider selection resolver.
- [x] Test no-LMS resolves as a configured tenant provider with the concrete no-LMS implementation.
- [x] Test planned Moodle and Canvas selections are not treated as runnable providers.
- [x] Test active external providers expose contract capabilities without creating adapter runtime.
- [x] Test paused and migration-required external providers are capability-gated.
- [x] Test cross-tenant provider resolution is denied.
- [x] Test provider-secret and raw provider payload fields are excluded from resolved output.
- [x] Run focused tests and verify they fail because the resolver module does not exist.

## Task 2: Tenant Provider Selection Resolver

- [x] Add `resolveTenantLmsProvider` under the LMS contract module.
- [x] Map institution LMS preference to `LmsTenantContext`.
- [x] Reuse the canonical provider descriptors from the contract module.
- [x] Attach the concrete no-LMS provider only for `none`.
- [x] Keep Moodle and Canvas descriptor-only, with no adapter runtime.
- [x] Gate capabilities by provider configuration status.
- [x] Reject cross-tenant resolution before returning provider details.
- [x] Keep resolved output free of provider secrets and raw provider payloads.
- [x] Run focused LMS tests and verify they pass.

## Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 7 Sprint 4 as complete in the roadmap.
- [x] Mark tenant-level provider selection complete in the master implementation plan.
- [x] Leave audit persistence, failure-mode runtime tests, Moodle adapter, and Canvas adapter unchecked for future sprints.

## Task 4: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Confirm no Moodle/Canvas adapter runtime, provider network calls, credential storage, migrations, API routes, webhooks, background jobs, or UI files were added.

## Review Boundary

This sprint is complete when tenant LMS provider selection is test-covered, all verification passes, and Moodle/Canvas remain descriptor-only.

## Next Sprint

Phase 7 Sprint 5 should implement sync audit and reconciliation model foundations.

It should add tenant-scoped audit/reconciliation types, tests, and no-runtime-storage foundations for future provider sync operations. It should not add Moodle/Canvas network calls or credential handling.
