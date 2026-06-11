# Phase 8 Sprint 4 Moodle Grade And Progress Return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Moodle grade and progress return import planning behind the provider-neutral LMS contract.

**Architecture:** This sprint converts provider-neutral Moodle grade/progress return batches into reviewed-import plans. Returned grade and progress values remain `pending_review`; they are not posted to official records, released to Student PWA, used for transcripts, or fed into ShepherdAI.

**Tech Stack:** TypeScript, node:test, existing LMS contract types, existing LMS audit/idempotency helpers.

---

## Factory Intake

- Product area: Moodle adapter runtime, grade return, progress return.
- Institution modes: all supported modes where Moodle is selected and active.
- Data touched: in-memory reviewed-import planning only; no database migrations, no Moodle network calls, no API routes, no official-record posting.
- Student PWA impact: none. Returned grade/progress values are not released to Student PWA in this sprint.
- LMS impact: adds Moodle grade/progress return planning only.
- Security/privacy: provider secrets and raw Moodle payloads remain server-side configuration inputs and are excluded from results and audit metadata.

## Files

- Create: `src/modules/lms-contract/moodle-grade-progress-return.ts`
- Create: `src/modules/lms-contract/__tests__/moodle-grade-progress-return.test.ts`
- Create: `docs/superpowers/plans/2026-06-04-phase-8-sprint-4-moodle-grade-progress-return.md`
- Modify: `docs/product/factory-roadmap.md`

## Task 1: Failing Tests

- [x] Add tests for active Moodle grade return reviewed-import planning.
- [x] Add tests for active Moodle progress return reviewed-import planning.
- [x] Add tests for planned, paused, and migration-required tenant provider status gating.
- [x] Add tests for tenant-matched configuration and batch enforcement.
- [x] Add tests requiring idempotency keys before reviewed imports are created.
- [x] Add tests proving provider secrets and raw Moodle payloads are excluded.
- [x] Run the new test path and observe the expected missing-module failure before implementation.

## Task 2: Moodle Grade Return Planner

- [x] Add `MoodleReturnConfiguration` as tenant-scoped server-side return configuration.
- [x] Add `createMoodleGradeReturnImportPlan`.
- [x] Return `needs_review` only when Moodle is selected, active, tenant matched, and the batch has an idempotency key.
- [x] Normalize returned grade results to `pending_review`.
- [x] Produce redacted LMS audit events through existing audit helpers.
- [x] Avoid official-record posting, transcript updates, Student PWA release, and ShepherdAI signal generation.

## Task 3: Moodle Progress Return Planner

- [x] Add `createMoodleProgressReturnImportPlan`.
- [x] Return `needs_review` only when Moodle is selected, active, tenant matched, and the batch has an idempotency key.
- [x] Normalize returned progress results to `pending_review`.
- [x] Produce redacted LMS audit events through existing audit helpers.
- [x] Avoid official progress-record posting, Student PWA release, and ShepherdAI signal generation.

## Task 4: Roadmap

- [x] Mark Moodle grade/progress return complete.
- [x] Set the next sprint to Moodle reconciliation and provider docs.

## Task 5: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Confirm no Moodle network calls, persistence, official-record posting, Student PWA release, ShepherdAI signal generation, webhook, or reconciliation runtime was added.

## Review Boundary

This sprint is complete when Moodle grade/progress return batches can be converted into safe reviewed-import plans with redacted audit events.

No live Moodle Web Service calls, credential storage, API routes, background jobs, official-record posting, transcript updates, Student PWA release, ShepherdAI signals, webhooks, or reconciliation runtime are included in this sprint.

## Next Sprint

Phase 8 Sprint 5 should implement Moodle reconciliation and provider docs.
