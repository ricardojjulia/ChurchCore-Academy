# LMS Roster Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an LMS roster-sync preview from real Academy sections and enrollments.

**Architecture:** Add a focused roster-source module that converts Academy course-section registrations into the existing LMS roster-sync contract input. Expose it through an admin-only API and a preview panel on `/admin/settings/lms`; no live provider network calls are added.

**Tech Stack:** Next.js App Router, React client component, TypeScript, node:test with `tsx`, existing Supabase/Postgres schema and LMS contract module.

---

### Task 1: Roster Source Module

**Files:**
- Create: `src/modules/lms-roster-source/types.ts`
- Create: `src/modules/lms-roster-source/postgres-repository.ts`
- Create: `src/modules/lms-roster-source/service.ts`
- Test: `src/modules/lms-roster-source/__tests__/lms-roster-source.test.ts`

- [x] Write failing tests for deriving instructor ids, student ids, and enrollment states from section registrations.
- [x] Run `node --import tsx --test src/modules/lms-roster-source/__tests__/lms-roster-source.test.ts` and confirm missing-module failure.
- [x] Implement types, repository, and service mapping.
- [x] Re-run the focused test and confirm it passes.

### Task 2: Real-Data LMS Roster API

**Files:**
- Create: `src/app/api/academy/lms/sections/[sectionId]/roster-plan/route.ts`
- Test: `src/app/api/academy/lms/sections/[sectionId]/roster-plan/route.test.ts`

- [x] Write failing tests proving the route builds a roster plan without caller-supplied student ids and denies malformed section ids.
- [x] Run the route test and confirm missing-route failure.
- [x] Implement the API using `withCapabilityContext`, `AcademyConfigRepository`, and `PostgresLmsRosterSourceRepository`.
- [x] Re-run the route test and confirm it passes.

### Task 3: LMS Settings Preview UI

**Files:**
- Modify: `src/app/admin/settings/lms/page.tsx`
- Create: `src/app/admin/settings/lms/LmsRosterPreviewClient.tsx`
- Test: `src/app/admin/settings/lms/__tests__/page-source.test.ts`

- [x] Write failing source tests for the roster preview panel and API route usage.
- [x] Implement sequential server reads for institution profile and section list.
- [x] Add a client preview component that fetches the new roster-plan route and renders safe summary data.
- [x] Re-run the focused UI source test.

### Task 4: Documentation And Verification

**Files:**
- Modify: `docs/product/product-context.md`
- Modify: `docs/superpowers/plans/2026-07-09-lms-roster-source.md`

- [x] Update product context to mark LMS roster source preview as working while keeping live activation evidence-gated.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm run verify:migration-seed-rehearsal`.
- [x] Run `git diff --check`.
- [x] Browser-smoke `/admin/settings/lms` roster preview.
