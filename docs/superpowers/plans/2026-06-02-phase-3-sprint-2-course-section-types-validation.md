# Phase 3 Sprint 2 Course And Section Types Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for course catalog validation behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add course catalog and section TypeScript types with deterministic validation tests.

**Architecture:** Introduce a new `src/modules/course-catalog/` module with provider-neutral course, section, prerequisite, duration, and LMS mapping types. Validation consumes existing institution, academic period, and subdivision references but does not add persistence, APIs, UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior.

**Tech Stack:** TypeScript, node:test, existing Academy institution defaults, existing academic-calendar types.

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

- TypeScript domain types only
- validation tests only
- no database tables
- no seed data changes

LMS impact: adds provider-neutral LMS mapping types and validation guardrails. No Moodle, Canvas, or provider runtime behavior is implemented.

Student PWA impact: adds future schedule and section references. No student-facing route or PWA behavior is implemented.

ShepherdAI impact: adds deterministic setup validation that future ShepherdAI signals may reuse. No recommendation runtime behavior is implemented.

Security/privacy impact: validation rejects cross-tenant references across courses, sections, periods, subdivisions, prerequisites, and LMS mappings.

## Files

- Create: `src/modules/course-catalog/types.ts`
- Create: `src/modules/course-catalog/validation.ts`
- Create: `src/modules/course-catalog/__tests__/course-catalog-validation.test.ts`
- Create: `docs/superpowers/plans/2026-06-02-phase-3-sprint-2-course-section-types-validation.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Validation Tests

- [x] Add tests for college credit courses and scheduled sections.
- [x] Add tests for Bible school clock-hour completion modules.
- [x] Add tests for children's school grade-band classes and progress records.
- [x] Add tests for transcript course duration requirements.
- [x] Add tests for children's school grade-band requirements.
- [x] Add tests for cross-tenant academic period references.
- [x] Add tests for circular prerequisites.
- [x] Add tests for LMS grade-return guardrails before the grading contract exists.
- [x] Run the focused test and confirm failure for the missing course catalog validation module.

### Task 2: Course Catalog Types

- [x] Add `CourseCatalogProfile`.
- [x] Add `CourseDuration`.
- [x] Add `Course`.
- [x] Add `CourseSection`.
- [x] Add `CoursePrerequisite`.
- [x] Add `CourseLmsMapping`.
- [x] Add `CourseCatalogConfiguration`.
- [x] Keep LMS mapping provider-neutral and free of provider tokens or sync runtime state.

### Task 3: Validation

- [x] Validate tenant scopes.
- [x] Validate catalog profile support flags against institution operating rules.
- [x] Validate course duration, credit, clock-hour, transcript, children's school, and competency rules.
- [x] Validate section references to courses, academic years, academic periods, and subdivisions.
- [x] Validate prerequisite references and circular prerequisite chains.
- [x] Validate LMS mapping references and prevent grade return or full section sync before later contracts exist.

### Task 4: Verification

- [x] Run the focused course catalog validation test.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm audit`.

## Review Boundary

This sprint is complete when course catalog and section types exist with deterministic validation coverage across the supported faith-based institution modes.

No persistence, seed data, API routes, UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

Phase 3 Sprint 3 should add course catalog persistence, seed data, and repository read behavior.

It should not add editable course workflows, instructor assignment workflows, admin UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior.
