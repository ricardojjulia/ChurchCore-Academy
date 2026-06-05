# Phase 7 Sprint 2 LMS Contract Interfaces And Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the provider-neutral LMS contract type surface and contract tests without adding provider adapters or runtime integration behavior.

**Architecture:** This sprint creates a pure TypeScript contract module under `src/modules/lms-contract/`. The module exports provider-neutral types, provider descriptors, capability helpers, safe launch response checks, idempotency metadata, webhook dedupe helpers, reviewed-import statuses, and reconciliation report shape. Moodle, Canvas, and no-LMS runtime providers remain future sprints.

**Tech Stack:** TypeScript, node:test, existing Next.js verification commands.

---

## Factory Intake

- Product area: LMS provider contract and no-LMS mode.
- Institution modes: all supported institution modes.
- Data touched: pure TypeScript contracts and docs only.
- Student PWA impact: defines safe launch response shape and provider-secret exclusions; no launch UI or runtime provider call is added.
- LMS impact: defines provider-neutral interfaces and contract tests for future Moodle, Canvas, and no-LMS providers.
- Security/privacy: provider secrets, access tokens, raw provider payloads, webhook signatures, and provider API credentials are named as excluded fields and tested.

## Files

- Create: `src/modules/lms-contract/contract.ts`
- Create: `src/modules/lms-contract/__tests__/lms-contract.test.ts`
- Create: `docs/superpowers/plans/2026-06-04-phase-7-sprint-2-lms-contract-interfaces-tests.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: Contract Tests

- [x] Write failing tests for provider descriptors and the provider-neutral capability matrix.
- [x] Write failing tests for no-LMS unsupported operation results.
- [x] Write failing tests for safe launch response field exclusions.
- [x] Write failing tests for idempotency-required capabilities.
- [x] Write failing tests for tenant/provider-scoped webhook dedupe keys.
- [x] Write failing tests for reviewed grade/progress import statuses.
- [x] Write failing tests for reconciliation report drift categories.
- [x] Run focused tests and verify they fail because the LMS contract module does not exist.

## Task 2: Contract Module

- [x] Add provider-neutral `LmsProviderId`, `LmsCapability`, context, request, response, webhook, audit, operation-result, and reconciliation types.
- [x] Add canonical provider descriptors for no-LMS, Moodle, and Canvas.
- [x] Add capability support helper.
- [x] Add unsupported operation-result factory for explicit no-LMS and unsupported capability outcomes.
- [x] Add launch response safety validator and provider-secret field allowlist tests.
- [x] Add idempotency metadata for mutating/import/webhook/reconciliation operations.
- [x] Add webhook dedupe key helper.
- [x] Add reviewed-import statuses for grade and progress return.
- [x] Add empty reconciliation report factory.
- [x] Run focused tests and verify they pass.

## Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 7 Sprint 2 as complete in the roadmap.
- [x] Mark provider-neutral interfaces and contract tests complete in the master implementation plan.
- [x] Leave no-LMS provider implementation, tenant provider selection, audit persistence, failure-mode runtime tests, Moodle adapter, and Canvas adapter unchecked for future sprints.

## Task 4: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Confirm no provider network calls, credential storage, migrations, API routes, or UI files were added.

## Review Boundary

This sprint is complete when the provider-neutral LMS contract module and contract tests are reviewable, all verification passes, and no adapter/runtime integration behavior has been added.

## Next Sprint

Phase 7 Sprint 3 should implement the no-LMS provider against this contract.

It should add a concrete no-LMS provider with explicit unsupported outcomes for external launch and sync operations, no-op reconciliation reports, safe Student PWA launch unavailable state, and contract conformance tests. It should not add Moodle, Canvas, credential storage, webhooks, background jobs, or provider network behavior.
