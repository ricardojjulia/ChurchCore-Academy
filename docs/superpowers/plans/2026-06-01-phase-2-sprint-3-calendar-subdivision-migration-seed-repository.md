# Phase 2 Sprint 3 Calendar And Subdivision Migration Seed Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-scoped academic calendar and subdivision persistence, seed data, and repository read behavior.

**Architecture:** Extend the Phase 2 academic-calendar domain with SQL storage and a Postgres read repository. Seed the mock Academy dataset with a valid mixed-institution calendar configuration while keeping APIs, UI, LMS adapters, ShepherdAI runtime behavior, and write endpoints out of scope.

**Tech Stack:** TypeScript, node:test, Supabase/Postgres migrations, existing local migration and seed scripts.

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

- Postgres schema for calendar profiles, academic years, academic periods, enrollment windows, grading windows, transcript periods, and subdivisions
- mock Academy seed data
- read-only repository mapping

LMS impact: none at runtime. Provider-neutral subdivision and period IDs are persisted for future LMS mapping.

Student PWA impact: none at runtime. Persisted period and subdivision records prepare future student schedule and cohort views.

ShepherdAI impact: none at runtime. Persisted setup data prepares future deterministic setup-gap signals.

Security/privacy impact: all tables include `tenant_id`; no write API or UI is exposed in this sprint.

## Files

- Create: `supabase/migrations/20260601020000_academic_calendar_subdivisions.sql`
- Create: `src/modules/academic-calendar/postgres-repository.ts`
- Create: `src/modules/academic-calendar/__tests__/academic-calendar-persistence.test.ts`
- Create: `src/modules/academic-calendar/__tests__/academic-calendar-repository.test.ts`
- Create: `docs/superpowers/plans/2026-06-01-phase-2-sprint-3-calendar-subdivision-migration-seed-repository.md`
- Modify: `src/modules/academy-data/types.ts`
- Modify: `src/modules/academy-data/mock-data.ts`
- Modify: `src/modules/academy-data/postgres-repository.ts`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Persistence Tests

- [x] Add migration discovery and SQL-shape tests.
- [x] Add seeded mock academic calendar validation test.
- [x] Add repository mapping and tenant-scoped read tests.
- [x] Run the focused tests and confirm failures for missing migration, seed data, and repository.

### Task 2: Migration

- [x] Create `academy_calendar_profiles`.
- [x] Create `academy_institution_subdivisions`.
- [x] Create `academy_academic_years`.
- [x] Create `academy_academic_periods`.
- [x] Create `academy_enrollment_windows`.
- [x] Create `academy_grading_windows`.
- [x] Create `academy_transcript_periods`.
- [x] Add tenant/subdivision and tenant/type indexes.

### Task 3: Seed Data

- [x] Add `academicCalendar` to `AcademyDataset`.
- [x] Seed a valid mixed-institution calendar configuration in mock data.
- [x] Update local seed repository to upsert calendar profiles, subdivisions, years, periods, enrollment windows, grading windows, and transcript periods.

### Task 4: Repository Read Path

- [x] Add `AcademyCalendarRepository`.
- [x] Add row mappers for calendar profiles, years, periods, windows, transcript periods, and subdivisions.
- [x] Read all records by `tenant_id = $1`.
- [x] Return a full `AcademicCalendarConfiguration`.
- [x] Report a missing tenant calendar profile clearly.

### Task 5: Verification

- [x] Run focused academic calendar persistence and repository tests.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when tenant-scoped calendar/subdivision persistence, seed data, and repository read behavior are present and verified.

No API route, admin UI, editable calendar workflow, LMS adapter behavior, ShepherdAI runtime behavior, or audit trail is included in this sprint.

## Next Sprint

Phase 2 Sprint 4 should expose an authorized repository/API read path or complete the subdivision repository surface, depending on whether the next review boundary prioritizes backend integration or admin review.
