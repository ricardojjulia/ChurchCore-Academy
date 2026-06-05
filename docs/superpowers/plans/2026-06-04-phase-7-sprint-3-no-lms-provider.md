# Phase 7 Sprint 3 No-LMS Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the concrete no-LMS provider against the provider-neutral LMS contract without adding Moodle, Canvas, credential storage, network calls, migrations, API routes, or UI.

**Architecture:** This sprint adds a `none` provider under `src/modules/lms-contract/`. The provider exposes the canonical no-LMS descriptor, returns safe unavailable launch responses for the Student PWA, returns explicit unsupported operation results for external LMS operations, and produces no-op reconciliation reports with no drift.

**Tech Stack:** TypeScript, node:test, existing Next.js verification commands.

---

## Factory Intake

- Product area: LMS provider contract and no-LMS mode.
- Institution modes: all supported institution modes.
- Data touched: pure TypeScript provider implementation and tests.
- Student PWA impact: defines the safe unavailable launch response for tenants without an external LMS; no Student PWA route or UI change is added.
- LMS impact: implements only the no-LMS provider. Moodle and Canvas remain future provider adapter phases.
- Security/privacy: no provider secrets, tokens, raw payloads, webhooks, credential storage, background jobs, or network behavior are added.

## Files

- Create: `src/modules/lms-contract/no-lms-provider.ts`
- Create: `src/modules/lms-contract/__tests__/no-lms-provider.test.ts`
- Create: `docs/superpowers/plans/2026-06-04-phase-7-sprint-3-no-lms-provider.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: No-LMS Provider Tests

- [x] Write failing tests that require a concrete no-LMS provider module.
- [x] Test that the provider declares the canonical no-LMS descriptor and no external capabilities.
- [x] Test that Student PWA launch receives a safe unavailable response.
- [x] Test that unsupported external LMS operations return explicit non-retryable unsupported results.
- [x] Test that reconciliation returns an empty no-op report with no drift.
- [x] Run focused tests and verify they fail because the provider module does not exist.

## Task 2: No-LMS Provider Implementation

- [x] Add `noLmsProvider` under the LMS contract module.
- [x] Reuse the canonical no-LMS descriptor from the provider-neutral contract.
- [x] Return a display-safe unavailable launch response without provider secrets or raw payloads.
- [x] Return explicit unsupported operation results for logout, provisioning, mapping, roster sync, enrollment sync, grade return, progress return, and webhooks.
- [x] Return no-op reconciliation reports with no drift categories.
- [x] Run focused LMS contract/provider tests and verify they pass.

## Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 7 Sprint 3 as complete in the roadmap.
- [x] Mark no-LMS provider implementation complete in the master implementation plan.
- [x] Leave tenant provider selection, audit persistence, failure-mode runtime tests, Moodle adapter, and Canvas adapter unchecked for future sprints.

## Task 4: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Confirm no Moodle, Canvas, provider network calls, credential storage, migrations, API routes, webhooks, background jobs, or UI files were added.

## Review Boundary

This sprint is complete when the no-LMS provider implementation and tests are reviewable, all verification passes, and no external provider runtime behavior has been added.

## Next Sprint

Phase 7 Sprint 4 should implement tenant provider selection.

It should connect institution LMS preference/configuration to the provider-neutral contract, resolve the active provider per tenant, preserve no-LMS as a valid configured mode, and keep credential storage/provider secrets out of domain records. It should not add Moodle or Canvas network calls.
