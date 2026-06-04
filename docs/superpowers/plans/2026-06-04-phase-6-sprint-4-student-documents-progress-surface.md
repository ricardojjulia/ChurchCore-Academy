# Phase 6 Sprint 4 Student Documents And Progress Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire student-scoped dashboard read models into the Student PWA dashboard, documents, and progress surfaces.

**Architecture:** Extend the Sprint 3 display-ready dashboard contract with released document summaries, then add a bootstrap source for the current no-auth local runtime. Server-rendered Student PWA pages consume only the filtered read model and never inspect raw people, provider, draft, held, or cross-student records.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, node:test, CSS, agent-browser.

---

## Factory Intake

- Product area: Student PWA dashboard, documents, and progress surfaces.
- Institution modes: Bible school, children's school, seminary, college, university, and mixed institution.
- Data touched: additive bootstrap read source only; no persistence or migrations.
- LMS impact: provider-neutral learning availability only.
- Security/privacy: UI consumes display-ready read models only. Draft, held, provider-secret, cross-tenant, and other-student records remain excluded.

## Files

- Create: `src/modules/student-pwa/bootstrap-dashboard.ts`
- Create: `src/modules/student-pwa/__tests__/bootstrap-dashboard.test.ts`
- Create: `src/components/student-dashboard-view.tsx`
- Create: `src/components/student-documents-view.tsx`
- Create: `src/components/student-progress-view.tsx`
- Modify: `src/modules/student-pwa/dashboard-read-model.ts`
- Modify: `src/modules/student-pwa/__tests__/dashboard-read-model.test.ts`
- Modify: `src/app/student/page.tsx`
- Modify: `src/app/student/documents/page.tsx`
- Modify: `src/app/student/progress/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Task 1: Documents And Bootstrap Read Source

- [x] Write failing tests for released document visibility, guardian document-category filtering, and safe bootstrap output.
- [x] Run focused tests and verify they fail because documents/bootstrap source are missing.
- [x] Extend the dashboard read model with display-ready document summaries.
- [x] Add the bootstrap source and loader for the current local student context.
- [x] Run focused tests and verify they pass.

## Task 2: Wire Student PWA Surfaces

- [x] Add focused dashboard, documents, and progress presentation components.
- [x] Wire `/student`, `/student/documents`, and `/student/progress` to the filtered bootstrap read model.
- [x] Add responsive styles and accessible empty states.
- [x] Confirm no page imports or renders raw people configuration, account links, provider URLs, or held records.

## Task 3: Verify And Deliver

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run desktop and mobile browser verification for dashboard, documents, and progress.
- [x] Run `git diff --check`.
- [x] Mark Phase 6 Sprint 4 complete; leave the broader master dashboard item open for messages and actual LMS launch.
- [x] Commit the accumulated Phase 6 work and push `main`.

## Review Boundary

This sprint is complete when the dashboard, documents, and progress pages render filtered student-scoped read models and browser verification passes. It must not add persistence, document download/upload, messages, registration, provider launches, staff preview, service workers, or offline academic-record caching.
