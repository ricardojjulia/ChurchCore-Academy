# Phase 7 Sprint 5 Sync Audit And Reconciliation Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add storage-free LMS sync audit and reconciliation foundations for future provider sync operations.

**Architecture:** This sprint adds pure helper functions under `src/modules/lms-contract/` for constructing redacted audit events, tenant/provider-scoped idempotency keys, webhook duplicate detection, and reconciliation summaries. It does not add audit persistence, migrations, background jobs, webhooks, provider network calls, Moodle/Canvas adapters, credential handling, or UI.

**Tech Stack:** TypeScript, node:test, existing Next.js verification commands.

---

## Factory Intake

- Product area: LMS provider contract, sync audit, and reconciliation.
- Institution modes: all supported institution modes.
- Data touched: pure TypeScript audit/reconciliation helpers and tests.
- Student PWA impact: none; no route, launch, or UI behavior is added.
- LMS impact: establishes storage-free foundations for future provider sync operations.
- Security/privacy: audit metadata redaction, tenant scope, idempotency, duplicate webhook detection, and reconciliation summary behavior are tested. No credential storage or raw provider payload persistence is added.

## Files

- Create: `src/modules/lms-contract/sync-audit-reconciliation.ts`
- Create: `src/modules/lms-contract/__tests__/sync-audit-reconciliation.test.ts`
- Create: `docs/superpowers/plans/2026-06-04-phase-7-sprint-5-sync-audit-reconciliation.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: Sync Audit And Reconciliation Tests

- [x] Write failing tests that require sync audit and reconciliation helpers.
- [x] Test tenant-scoped audit event creation with provider-secret redaction.
- [x] Test cross-tenant audit target references are denied before event creation.
- [x] Test tenant/provider/capability-scoped operation idempotency keys.
- [x] Test tenant/provider-scoped webhook duplicate detection.
- [x] Test reconciliation summaries count drift categories and required actions.
- [x] Test clean reconciliation summaries require no action.
- [x] Run focused tests and verify they fail because the helper module does not exist.

## Task 2: Sync Audit And Reconciliation Helpers

- [x] Add `createLmsAuditEvent`.
- [x] Redact provider secrets and raw provider payloads from audit metadata.
- [x] Reject cross-tenant audit target references.
- [x] Add `buildLmsOperationIdempotencyKey`.
- [x] Add `isDuplicateLmsWebhookEvent`.
- [x] Add `summarizeLmsReconciliationReport`.
- [x] Keep helpers storage-free and provider-runtime-free.
- [x] Run focused LMS tests and verify they pass.

## Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 7 Sprint 5 as complete in the roadmap.
- [x] Mark audit logs for provider sync operations and failure-mode foundations complete in the master implementation plan.
- [x] Leave Moodle adapter and Canvas adapter unchecked for future phases.

## Task 4: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Confirm no Moodle/Canvas adapter runtime, provider network calls, credential storage, migrations, API routes, webhooks, background jobs, or UI files were added.

## Review Boundary

This sprint is complete when audit/reconciliation foundations are test-covered, all verification passes, and no provider runtime or persistence behavior has been added.

## Next Sprint

Phase 8 Sprint 1 should begin the Moodle adapter design package.

It should stay docs-first, define the Moodle adapter boundary against the provider-neutral contract, and avoid Moodle network calls until the adapter implementation sprint.
