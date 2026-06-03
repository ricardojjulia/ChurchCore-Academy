# Phase 5 Sprint 7 Grading Review UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for review-model behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-backed, read-only admin review UI for grading profile, evaluation scales, rule sets, official record rules, academic standing rules, and validation warnings.

**Architecture:** Add a deterministic `buildGradingRecordsReviewModel` read model and a dynamic `/settings/grading` page. The page loads persisted grading configuration through `AcademyGradingRecordsRepository`, builds display-oriented review sections, and uses the existing Academy settings shell/card pattern. It does not add editing, write APIs, LMS provider calls, transcript document generation, student PWA surfaces, or ShepherdAI runtime behavior.

**Tech Stack:** Next.js App Router server component, TypeScript, node:test, existing Academy UI primitives, lucide-react icons, existing grading-records repository and validation module.

---

## Factory Intake

Product area: grading setup review, official record posture, academic standing, promotion, graduation readiness, admin UI.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched:

- read-only review model
- settings page
- sidebar navigation
- scoped CSS
- factory roadmap docs
- no database migration
- no seed data changes
- no write API

LMS impact: UI displays provider-neutral LMS grade-return policy and validation warnings, but does not connect Moodle, Canvas, or any LMS provider.

Student PWA impact: none directly. The UI is an admin review surface only.

ShepherdAI impact: none directly. Future recommendations can point admins to the same validation warnings and rule gaps.

Security/privacy impact: page uses repository-backed server-side data for the seeded tenant and remains read-only. No student grades, grade submissions, credentials, or provider secrets are exposed in this sprint.

## Files

- Create: `src/modules/grading-records/review-view.ts`
- Create: `src/modules/grading-records/__tests__/grading-records-review-view.test.ts`
- Create: `src/app/settings/grading/page.tsx`
- Create: `docs/superpowers/plans/2026-06-02-phase-5-sprint-7-grading-review-ui.md`
- Modify: `src/components/academy-shell.tsx`
- Modify: `src/app/globals.css`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Review-Model Tests

- [x] Add seeded grading review-model test for summary, metrics, profile rows, coverage, scales, rule sets, official-record rules, standing rules, and validation.
- [x] Add invalid grading setup test that surfaces validation warning count and LMS direct-post posture.
- [x] Run focused test and confirm failure for the missing review model.

### Task 2: Review Model

- [x] Add metric, profile, coverage, scale, rule-set, official-record, and standing-rule DTOs.
- [x] Add label formatting for grading, record, LMS, release, and standing values.
- [x] Add scale band summaries.
- [x] Add downstream official-record inclusion summaries.
- [x] Add standing threshold and criteria summaries.
- [x] Preserve validation warnings from `validateGradingRecordsConfiguration`.

### Task 3: Admin UI

- [x] Add `/settings/grading` dynamic page.
- [x] Load grading configuration through `AcademyGradingRecordsRepository`.
- [x] Render metrics, profile, coverage, evaluation scales, rule sets, official record rules, standing rules, and validation warnings.
- [x] Add Grading sidebar navigation entry.
- [x] Add scoped responsive CSS for grading cards, coverage, details, and validation panel.

### Task 4: Roadmap And Master Plan Updates

- [x] Mark Phase 5 Sprint 7 as complete in the factory roadmap.
- [x] Mark grading model review UI complete in the master implementation plan.
- [x] Keep editing, write APIs, LMS adapters, student PWA, and ShepherdAI runtime unchecked for future phases.

### Task 5: Verification

- [x] Run focused grading review-model tests.
- [x] Run focused grading API route tests.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when admins have a read-only grading setup page that shows persisted grading configuration, official-record posture, academic standing rules, and validation warnings.

No editing, write API, LMS adapter behavior, student PWA behavior, transcript document generation, official evaluation-result entry, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

The next highest-leverage move is a Phase 5 closeout hardening pass: verify the grading page with browser automation, apply migrations/seeds locally if the environment is configured, and then commit/push the accumulated Phase 5 grading slices before starting Phase 6 Student PWA.
