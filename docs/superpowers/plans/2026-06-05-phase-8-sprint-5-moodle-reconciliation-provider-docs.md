# Phase 8 Sprint 5 Moodle Reconciliation And Provider Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Moodle reconciliation reporting and provider configuration documentation.

**Architecture:** This sprint compares Academy-expected Moodle sync state with observed Moodle snapshots and returns provider-neutral `LmsReconciliationReport` objects. Reconciliation reports recommend review actions only; they do not call Moodle, mutate records, post official grades, release Student PWA data, or write provider mappings.

**Tech Stack:** TypeScript, node:test, existing LMS contract reconciliation types, Markdown docs.

---

## Factory Intake

- Product area: Moodle adapter runtime, reconciliation, provider documentation.
- Institution modes: all supported modes where Moodle is selected and active.
- Data touched: in-memory reconciliation reporting and documentation only.
- Student PWA impact: none.
- LMS impact: completes Phase 8 Moodle adapter planning/runtime foundations.
- Security/privacy: secrets and raw Moodle payloads are excluded from reports, checklists, and docs.

## Files

- Create: `src/modules/lms-contract/moodle-reconciliation.ts`
- Create: `src/modules/lms-contract/__tests__/moodle-reconciliation.test.ts`
- Create: `docs/integrations/moodle-provider-configuration.md`
- Create: `docs/superpowers/plans/2026-06-05-phase-8-sprint-5-moodle-reconciliation-provider-docs.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: Failing Tests

- [x] Add tests for Moodle mapping, roster, return, and capability drift.
- [x] Add tests for clean reconciliation summaries.
- [x] Add tests for planned, paused, and migration-required tenant provider gating.
- [x] Add tests rejecting cross-tenant reconciliation configuration.
- [x] Add tests for provider docs checklist coverage.
- [x] Run the new test path and observe the expected missing-module failure before implementation.

## Task 2: Moodle Reconciliation

- [x] Add `MoodleReconciliationConfiguration` and `MoodleReconciliationSnapshot`.
- [x] Add `createMoodleReconciliationReport`.
- [x] Detect missing, stale, and duplicate Moodle course shell mappings.
- [x] Detect roster and enrollment drift.
- [x] Detect grade and progress return drift.
- [x] Detect capability mismatches.
- [x] Return required actions without mutating Academy or Moodle records.
- [x] Exclude provider secrets and raw Moodle payloads.

## Task 3: Provider Docs

- [x] Add Moodle provider configuration guide.
- [x] Document Web Services setup boundaries, secret handling, sync families, deployment notes, and trademark notes.
- [x] Add a provider docs checklist helper for release verification.

## Task 4: Roadmap And Master Plan

- [x] Mark Moodle reconciliation and provider docs complete.
- [x] Mark Moodle configuration and trademark/deployment documentation complete in the master plan.
- [x] Set the next roadmap focus to Phase 9 Canvas Adapter.

## Task 5: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Confirm no Moodle network calls, persistence, API routes, official-record posting, Student PWA release, ShepherdAI signal generation, or automatic remediation runtime was added.

## Review Boundary

This sprint is complete when Moodle reconciliation can produce safe drift reports and provider setup docs are available for tenant onboarding.

No live Moodle Web Service calls, credential storage, API routes, background jobs, official-record posting, transcript updates, Student PWA release, ShepherdAI signals, or automatic reconciliation remediation are included in this sprint.

## Next Sprint

Phase 9 Sprint 1 should begin the Canvas adapter design package.
