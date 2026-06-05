# Phase 8 Sprint 2 Moodle Identity And Launch Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Moodle identity and launch mapping behind the provider-neutral LMS contract.

**Architecture:** Moodle launch is implemented as a display-safe `LmsLaunchResponse` mapper in the LMS contract module, with a Student PWA bridge that reuses existing self-access and guardian-relationship scope checks. Moodle launch configuration is treated as tenant-scoped server-side input; Moodle Web Service tokens, OIDC secrets, LTI keys, raw Moodle identifiers, and raw provider payloads are never returned to browser-facing launch responses.

**Tech Stack:** TypeScript, node:test, existing LMS contract types, existing Student PWA access policy.

---

## Factory Intake

- Product area: Moodle adapter runtime, identity launch, Student PWA launch boundary.
- Institution modes: all supported modes where Moodle is selected.
- Data touched: in-memory provider launch mapping only; no database migrations, no Moodle network calls, no service worker/cache changes.
- Student PWA impact: adds a reusable Student PWA launch bridge that returns display-safe launch responses after self/guardian scope checks.
- LMS impact: adds Moodle launch mapping only; course provisioning, roster sync, grade return, progress return, webhooks, and reconciliation runtime remain future sprints.
- Security/privacy: keeps Moodle Web Service tokens, OIDC secrets, LTI keys, raw Moodle identifiers, and raw provider payloads out of launch responses.

## Files

- Create: `src/modules/lms-contract/moodle-launch.ts`
- Create: `src/modules/student-pwa/moodle-launch.ts`
- Create: `src/modules/lms-contract/__tests__/moodle-launch.test.ts`
- Create: `docs/superpowers/plans/2026-06-04-phase-8-sprint-2-moodle-identity-launch-mapping.md`
- Modify: `docs/product/factory-roadmap.md`

## Task 1: Failing Tests

- [x] Add tests for active configured Moodle launch returning a display-safe `LmsLaunchResponse`.
- [x] Add tests for missing/incomplete Moodle launch configuration returning unavailable responses.
- [x] Add tests for planned, paused, and migration-required tenant provider statuses.
- [x] Add tests for cross-tenant launch configuration rejection.
- [x] Add tests for Student PWA self-access and guardian relationship launch scope.
- [x] Add tests proving provider secrets, raw Moodle identifiers, and raw provider payloads are excluded.
- [x] Run the new test path and observe the expected missing-module failure before implementation.

## Task 2: Moodle Launch Mapper

- [x] Add `MoodleLaunchConfiguration` as tenant-scoped server-side launch configuration.
- [x] Add `createMoodleLaunchResponse` behind the provider-neutral LMS contract.
- [x] Return available launch responses only when Moodle is selected, active, configured, and tenant matched.
- [x] Return safe unavailable responses for unconfigured, planned, paused, migration-required, and non-Moodle states.
- [x] Generate short-lived launch URLs from non-secret configuration only.
- [x] Keep course provisioning, roster sync, grade/progress return, webhooks, and reconciliation runtime out of this module.

## Task 3: Student PWA Bridge

- [x] Add `createStudentMoodleLaunchResponse`.
- [x] Reuse `resolveStudentPwaAccess` for student self-access, guardian relationship scope, and tenant isolation.
- [x] Convert scoped access into a provider-neutral `LmsLaunchRequest`.
- [x] Return only the safe LMS contract launch response.

## Task 4: Roadmap

- [x] Mark Moodle identity and launch mapping complete.
- [x] Set the next sprint to Moodle course and roster sync.

## Task 5: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Confirm no course provisioning, roster sync, grade return, progress return, webhook, reconciliation, or Moodle network-call runtime was added.

## Review Boundary

This sprint is complete when Moodle identity launch returns safe provider-neutral responses and Student PWA launch access is scoped by existing student/guardian rules.

No Moodle Web Service calls, live OIDC exchange, LTI registration, persistence, provider secret storage, course provisioning, roster sync, grade return, progress return, webhooks, or reconciliation runtime is included in this sprint.

## Next Sprint

Phase 8 Sprint 3 should implement Moodle course and roster sync.
