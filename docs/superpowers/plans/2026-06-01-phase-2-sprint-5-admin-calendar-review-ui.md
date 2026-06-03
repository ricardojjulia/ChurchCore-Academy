# Phase 2 Sprint 5 Admin Calendar Review UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for review-model behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only admin review page for academic calendar configuration.

**Architecture:** Build a small calendar review model that turns the existing academic-calendar configuration into readable UI sections, then render it through the existing Academy settings shell. The page uses seeded Academy data like the institution review page so static builds do not require a live database connection.

**Tech Stack:** Next.js App Router, React, TypeScript, node:test, existing Academy shell/components, academic-calendar domain validation.

---

## Factory Intake

Product area: Academic Calendar and Institutional Structure.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched:

- no new database tables
- no seed data changes
- read-only UI over existing seeded academic calendar configuration

LMS impact: none at runtime. Period and subdivision labels are visible for future provider-neutral LMS mapping review.

Student PWA impact: none at runtime. The UI confirms the calendar structure future student schedule and registration views will consume.

ShepherdAI impact: none at runtime. Calendar validation warnings are surfaced for future deterministic setup-gap recommendations.

Security/privacy impact: page is an admin settings surface and contains configuration metadata only; no student records, grades, or LMS tokens are exposed.

## Files

- Create: `src/modules/academic-calendar/review-view.ts`
- Create: `src/modules/academic-calendar/__tests__/academic-calendar-review-view.test.ts`
- Create: `src/app/settings/calendar/page.tsx`
- Create: `docs/superpowers/plans/2026-06-01-phase-2-sprint-5-admin-calendar-review-ui.md`
- Modify: `src/components/academy-shell.tsx`
- Modify: `src/app/globals.css`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Review-Model Tests

- [x] Add tests for readable summary metrics.
- [x] Add tests for academic year, period, subdivision, and operational-window labels.
- [x] Add tests for validation warnings in the review model.
- [x] Run the focused test and confirm failure for the missing review-view module.

### Task 2: Calendar Review Model

- [x] Add `buildAcademicCalendarReviewModel`.
- [x] Convert calendar system, term structure, period types, statuses, record types, and subdivision modes into readable labels.
- [x] Resolve period windows to period names.
- [x] Resolve years and periods to subdivision names.
- [x] Include validation warnings from `validateAcademicCalendarConfiguration`.

### Task 3: Admin Review UI

- [x] Add `/settings/calendar`.
- [x] Render summary metrics, calendar profile, academic years, periods, windows, subdivisions, and validation warnings.
- [x] Add Calendar navigation to the Academy shell.
- [x] Add scoped calendar review CSS for dense desktop and mobile layouts.

### Task 4: Verification

- [x] Run the focused calendar review-model test.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Browser-verify `/settings/calendar` on the local dev server.

## Review Boundary

This sprint is complete when administrators can review academic calendar configuration from a dedicated settings page with validation status and readable relationships between years, periods, windows, and subdivisions.

No calendar editing, audit trail, LMS adapter behavior, ShepherdAI runtime behavior, student PWA workflow, or production session binding is included in this sprint.

## Next Sprint

Phase 2 should close with either calendar configuration review hardening or move into Phase 3 with a course catalog design package. The highest-leverage next domain is Phase 3 Sprint 1: Course Catalog and Section Design Package, because periods and subdivisions are now visible and ready to be referenced by courses and sections.
