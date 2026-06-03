# Phase 3 Sprint 3 Course Catalog Migration Seed Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for persistence and repository behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-scoped course catalog persistence, seed data, and repository read behavior.

**Architecture:** Extend the Phase 3 course-catalog domain with SQL storage and a Postgres read repository. Seed the mock Academy dataset with valid Bible school, children's school, practicum, and attendance course examples while keeping APIs, UI, editable workflows, LMS adapter behavior, student PWA behavior, and ShepherdAI runtime behavior out of scope.

**Tech Stack:** TypeScript, node:test, Supabase/Postgres migrations, existing local migration and seed scripts.

---

## Factory Intake

Product area: Course Catalog, Sections, Instructional Assignment, and LMS Mapping References.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched:

- Postgres schema for course catalog profiles, courses, sections, prerequisites, and LMS mappings
- mock Academy seed data
- read-only repository mapping

LMS impact: provider-neutral LMS mapping rows are persisted for future Moodle, Canvas, and no-LMS contract work. No provider runtime code is included.

Student PWA impact: persisted course and section records prepare future student schedule, course, and LMS launch views.

ShepherdAI impact: persisted course setup data prepares future deterministic setup-gap signals.

Security/privacy impact: all new tables include `tenant_id`; repository reads are tenant-scoped; no write API or UI is exposed in this sprint.

## Files

- Create: `supabase/migrations/20260602010000_course_catalog_sections.sql`
- Create: `src/modules/course-catalog/postgres-repository.ts`
- Create: `src/modules/course-catalog/__tests__/course-catalog-persistence.test.ts`
- Create: `src/modules/course-catalog/__tests__/course-catalog-repository.test.ts`
- Create: `docs/superpowers/plans/2026-06-02-phase-3-sprint-3-course-catalog-migration-seed-repository.md`
- Modify: `src/modules/academy-data/types.ts`
- Modify: `src/modules/academy-data/mock-data.ts`
- Modify: `src/modules/academy-data/postgres-repository.ts`
- Modify: `src/modules/course-catalog/validation.ts`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Persistence Tests

- [x] Add migration discovery and SQL-shape tests.
- [x] Add seeded mock course catalog validation test.
- [x] Add repository mapping and tenant-scoped read tests.
- [x] Run focused tests and confirm failures for missing migration, seed data, and repository.

### Task 2: Migration

- [x] Create `academy_course_catalog_profiles`.
- [x] Create `academy_courses`.
- [x] Create `academy_course_sections`.
- [x] Create `academy_course_prerequisites`.
- [x] Create `academy_course_lms_mappings`.
- [x] Add tenant, code, period, prerequisite, and LMS mapping indexes.

### Task 3: Seed Data

- [x] Add `courseCatalog` to `AcademyDataset`.
- [x] Seed valid Bible school, children's school, ministry practicum, and chapel course catalog data.
- [x] Update local seed repository to upsert catalog profile, courses, sections, prerequisites, and LMS mappings.
- [x] Keep seeded LMS mapping provider-neutral and no-LMS compatible.

### Task 4: Repository Read Path

- [x] Add `AcademyCourseCatalogRepository`.
- [x] Add row mappers for catalog profile, academic references, subdivisions, courses, sections, prerequisites, and LMS mappings.
- [x] Read all records by `tenant_id = $1`.
- [x] Return a full `CourseCatalogConfiguration`.
- [x] Report a missing tenant course catalog profile clearly.

### Task 5: Verification

- [x] Run focused course catalog persistence and repository tests.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run local migration and seed commands.
- [x] Verify repository read behavior against the local database.

## Review Boundary

This sprint is complete when tenant-scoped course catalog persistence, seed data, and repository read behavior are present and verified.

No API route, admin UI, editable catalog workflow, instructor assignment workflow, LMS adapter behavior, ShepherdAI runtime behavior, student PWA behavior, or audit trail is included in this sprint.

## Next Sprint

Phase 3 Sprint 4 should expose an authorized course catalog repository/API read path or start instructor assignment workflows, depending on whether the next review boundary prioritizes backend integration or workflow behavior.
