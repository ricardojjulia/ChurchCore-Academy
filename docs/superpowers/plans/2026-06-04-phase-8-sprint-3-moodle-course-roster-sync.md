# Phase 8 Sprint 3 Moodle Course And Roster Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Moodle course shell and roster sync planning behind the provider-neutral LMS contract.

**Architecture:** This sprint adds a Moodle sync planner that converts provider-neutral course shell and roster requests into safe, idempotent Moodle provider-operation plans. The planner does not call Moodle, store Moodle credentials, mutate Academy records, return grade/progress imports, or add reconciliation runtime.

**Tech Stack:** TypeScript, node:test, existing LMS contract types, existing LMS audit/idempotency helpers.

---

## Factory Intake

- Product area: Moodle adapter runtime, course shell provisioning, roster sync.
- Institution modes: all supported modes where Moodle is selected and active.
- Data touched: in-memory sync planning only; no database migrations, no Moodle network calls, no background jobs, no API routes.
- Student PWA impact: none.
- LMS impact: adds Moodle course shell and roster planning only.
- Security/privacy: provider secrets and raw Moodle payloads remain server-side configuration inputs and are excluded from results, audit metadata, and provider-operation plans.

## Files

- Create: `src/modules/lms-contract/moodle-course-roster-sync.ts`
- Create: `src/modules/lms-contract/__tests__/moodle-course-roster-sync.test.ts`
- Create: `docs/superpowers/plans/2026-06-04-phase-8-sprint-3-moodle-course-roster-sync.md`
- Modify: `docs/product/factory-roadmap.md`

## Task 1: Failing Tests

- [x] Add tests for active Moodle course shell provisioning plan creation.
- [x] Add tests for active Moodle roster sync plan creation.
- [x] Add tests for planned, paused, and migration-required tenant provider status gating.
- [x] Add tests for tenant-matched configuration and request enforcement.
- [x] Add tests requiring idempotency keys before provider operations are planned.
- [x] Add tests proving access tokens, raw Moodle payloads, and external Moodle ids are excluded.
- [x] Run the new test path and observe the expected missing-module failure before implementation.

## Task 2: Moodle Course Shell Planner

- [x] Add `MoodleSyncConfiguration` as tenant-scoped server-side sync configuration.
- [x] Add `createMoodleCourseShellProvisioningPlan`.
- [x] Return success only when Moodle is selected, active, tenant matched, and the request has an idempotency key.
- [x] Return unsupported plans for planned, paused, migration-required, and inactive Moodle states.
- [x] Produce a safe `upsert_course_shell` provider-operation plan with stable tenant/course/section keys.
- [x] Produce redacted LMS audit events through existing audit helpers.

## Task 3: Moodle Roster Planner

- [x] Add `createMoodleRosterSyncPlan`.
- [x] Map instructor person ids to the configured Moodle instructor role.
- [x] Map student person ids to the configured Moodle student role with provider-neutral enrollment states.
- [x] Avoid guardian-specific Moodle role elevation in this sprint.
- [x] Produce a safe `sync_roster_membership` provider-operation plan with tenant-scoped section key.
- [x] Produce redacted LMS audit events through existing audit helpers.

## Task 4: Roadmap

- [x] Mark Moodle course and roster sync complete.
- [x] Set the next sprint to Moodle grade/progress return.

## Task 5: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Confirm no Moodle network calls, persistence, background jobs, grade/progress return, webhook, or reconciliation runtime was added.

## Review Boundary

This sprint is complete when Moodle course shell and roster requests can be converted into safe, idempotent provider-operation plans with redacted audit events.

No live Moodle Web Service calls, credential storage, API routes, background jobs, grade/progress return, webhooks, reconciliation runtime, or Student PWA changes are included in this sprint.

## Next Sprint

Phase 8 Sprint 4 should implement Moodle grade/progress return.
