# Phase 4 Sprint 6 People And Role Admin Review UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for review-model behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the people and role admin review UI backed by `AcademyPeopleRepository` instead of mock-only data.

**Architecture:** Add a pure people review model, a repository-backed loader, and a dynamic Next.js settings page at `/settings/people`. The page is read-only and renders students, staff, guardians, role coverage, account links, relationship visibility, and validation warnings. Editing, account provisioning, API write endpoints, LMS adapters, student PWA screens, and ShepherdAI runtime behavior stay out of scope.

**Tech Stack:** Next.js App Router, React, TypeScript, node:test, existing Academy shell/components, people domain repository and validation.

---

## Factory Intake

Product area: People Directory, Role Boundaries, Guardian Relationships, Faculty/Teacher Assignment, and Student Visibility.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched:

- repository-read people configuration only
- no schema changes
- no seed data changes
- no write endpoints

LMS impact: displays account-link posture and confirms no secrets are stored; no Moodle or Canvas adapter behavior.

Student PWA impact: exposes administrator review of the people data that future student and guardian PWA surfaces will depend on.

ShepherdAI impact: none at runtime. Validation warnings can feed future setup-gap recommendations.

Security/privacy impact: relationship visibility, guardian readiness, role coverage, and account-link secret posture are visible to administrators.

## Files

- Create: `src/modules/people/review-view.ts`
- Create: `src/modules/people/review-loader.ts`
- Create: `src/modules/people/__tests__/people-review-view.test.ts`
- Create: `src/modules/people/__tests__/people-review-loader.test.ts`
- Create: `src/app/settings/people/page.tsx`
- Modify: `src/components/academy-shell.tsx`
- Modify: `src/app/globals.css`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Review Tests

- [x] Add seeded review-model coverage for metrics, role coverage, students, relationships, and validation.
- [x] Add warning coverage for missing guardian relationship readiness.
- [x] Add loader coverage proving review data is fetched through a repository reader.
- [x] Run focused tests and confirm expected failures for missing review modules.

### Task 2: Review Model And Loader

- [x] Add `buildPeopleReviewModel`.
- [x] Add summary metrics for people, students, staff, guardians, and validation.
- [x] Add role and person-status coverage.
- [x] Add student, staff, relationship, and account-link review rows.
- [x] Add account-link secret posture labels.
- [x] Add `loadPeopleReviewModel` with a repository-reader contract.

### Task 3: Admin Review UI

- [x] Add `/settings/people` as a dynamic server page.
- [x] Load the model through `AcademyPeopleRepository`.
- [x] Add navigation entry for People.
- [x] Render profile, role coverage, students, faculty/staff, relationships, account links, and validation review panels.
- [x] Add responsive people review styling.

### Task 4: Roadmap And Master Plan Updates

- [x] Mark Phase 4 Sprint 6 as complete in the factory roadmap.
- [x] Mark people and role admin review UI complete in the master implementation plan.

### Task 5: Verification

- [x] Run focused people review tests.
- [x] Run `npm run lint`.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `npm run db:migrate:local`.
- [x] Run `npm run db:seed:local`.
- [x] Verify `http://localhost:3000/settings/people` returns `200 OK` and rendered people review content.

## Review Boundary

This sprint is complete when administrators can review people and role setup from `/settings/people`, and the page is backed by `AcademyPeopleRepository`.

No edit UI, write endpoint, account provisioning, LMS adapter behavior, student PWA screen, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

Phase 5 Sprint 1 should begin the grading and transcript rules design package. It should not start grading code until the model supports children's progress records, Bible school completion records, seminary/college/university transcripts, GPA-bearing programs, competency or narrative evaluation, and promotion/graduation rules.
