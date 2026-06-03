# Phase 3 Sprint 5 Course Setup Review UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: Use superpowers:test-driven-development for review-model behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only admin review screen for tenant course catalog setup, section readiness, duration posture, instructor assignment readiness, and provider-neutral LMS mapping status.

**Architecture:** Reuse the existing seeded course catalog configuration and validation model. The UI is an admin review surface only; it does not introduce editing, instructor assignment workflows, LMS adapter behavior, student PWA behavior, or API changes.

**Tech Stack:** Next.js App Router, React, TypeScript, node:test, existing Academy shell and card components.

---

## Factory Intake

Product area: Course Catalog, Sections, Instructional Assignment Readiness, and LMS Mapping References.

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
- read-only model and page over existing course catalog configuration

LMS impact: provider-neutral review only. No Moodle, Canvas, or provider runtime logic is introduced.

Student PWA impact: none. The page prepares future schedule/course review concepts but exposes no student route.

ShepherdAI impact: none at runtime. Validation warnings remain deterministic and can later feed setup-gap recommendations.

Security/privacy impact: page is currently an admin shell review route over mock tenant data. Future API-bound screens must reuse tenant-scoped read permissions.

## Files

- Create: `src/modules/course-catalog/review-view.ts`
- Create: `src/modules/course-catalog/__tests__/course-catalog-review-view.test.ts`
- Create: `src/app/settings/courses/page.tsx`
- Create: `docs/superpowers/plans/2026-06-02-phase-3-sprint-5-course-setup-review-ui.md`
- Modify: `src/components/academy-shell.tsx`
- Modify: `src/app/globals.css`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Review Model Tests

- [x] Add seeded course setup review model coverage.
- [x] Add validation warning coverage for missing instructor readiness.
- [x] Run the focused test and confirm failure for the missing review module.

### Task 2: Course Review Model

- [x] Build summary and metric rows for courses, sections, LMS mappings, and validation.
- [x] Build course type and record type coverage groups.
- [x] Build course rows with duration, subdivision, grade band, level, record type, and status.
- [x] Build section rows with academic year, period, subdivision, delivery mode, capacity, instructor role, and assignment readiness.
- [x] Build provider-neutral LMS mapping rows.

### Task 3: Admin Review UI

- [x] Add `/settings/courses` route.
- [x] Add Catalog Profile, Course Coverage, Section Readiness, Courses, LMS Mapping, and Validation Review cards.
- [x] Add Courses sidebar navigation entry.
- [x] Add responsive course review CSS.

### Task 4: Verification

- [x] Run the focused course catalog review test.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Verify `/settings/courses` in browser automation.

## Review Boundary

This sprint is complete when administrators can review course setup posture from `/settings/courses`, and the review model is covered by deterministic tests.

No course editing, instructor assignment workflow, roster workflow, syllabus workflow, LMS adapter behavior, ShepherdAI runtime behavior, student PWA route, or audit trail is included in this sprint.

## Next Sprint

The next highest-leverage move is the people and roles design package, because instructor assignment workflows depend on a durable teacher/professor/faculty/administrator model.
