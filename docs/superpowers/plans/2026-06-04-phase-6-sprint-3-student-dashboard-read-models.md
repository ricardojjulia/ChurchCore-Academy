# Phase 6 Sprint 3 Student Dashboard Read Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add display-ready, student-scoped dashboard read models that enforce self-access, guardian relationship scope, tenant isolation, release filtering, and provider-secret exclusion.

**Architecture:** Add a focused Student PWA dashboard source contract for future repositories to implement. Resolve actor-to-student access before reading dashboard data, filter each category by release state and guardian visibility, and return a provider-neutral display model that cannot carry launch URLs, tokens, credentials, or raw provider records.

**Tech Stack:** TypeScript, existing Academy people access policy, node:test, Next.js verification commands.

---

## Factory Intake

- Product area: Student PWA dashboard read models.
- Institution modes: Bible school, children's school, seminary, college, university, and mixed institution.
- Data touched: additive in-memory read-model contracts only; no persistence or migrations.
- LMS impact: expose provider-neutral availability counts only.
- Security/privacy: deny cross-tenant reads, other-student self reads, inactive/insufficient guardian relationships, staff impersonation, draft records, held records, and provider secrets.

## Files

- Create: `src/modules/student-pwa/student-access.ts`
- Create: `src/modules/student-pwa/dashboard-read-model.ts`
- Create: `src/modules/student-pwa/__tests__/dashboard-read-model.test.ts`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: Access Resolution

- [x] Write failing tests for student self-access, other-student denial, guardian relationship scope, expired guardian denial, staff denial, and cross-tenant denial.
- [x] Run the dashboard read-model test and verify it fails because the read model does not exist.
- [x] Implement the minimal access resolver using active Academy person roles and relationship-scoped guardian categories.
- [x] Run the dashboard read-model test and verify access tests pass.

## Task 2: Dashboard Filtering

- [x] Write failing tests for released schedule/course/progress visibility, draft/held filtering, guardian category filtering, and provider-secret exclusion.
- [x] Implement the display-ready dashboard source and result contracts.
- [x] Filter every source item by target student, tenant, release state, and resolved access categories.
- [x] Return provider-neutral learning availability without source launch fields.
- [x] Run the dashboard read-model test and verify it passes.

## Task 3: Verify And Close The Sprint

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Mark Phase 6 Sprint 3 and the master-plan data-boundary test item complete.

## Review Boundary

This sprint is complete when the additive read-model contracts and denial/visibility tests are reviewable. It must not add persistence, API routes, document/message stores, LMS launches, provider calls, offline caching, staff preview, or student mutations.
