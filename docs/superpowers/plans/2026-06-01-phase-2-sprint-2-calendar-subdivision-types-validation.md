# Phase 2 Sprint 2 Calendar And Subdivision Types Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement academic calendar and subdivision TypeScript types with deterministic validation tests.

**Architecture:** Add a pure `src/modules/academic-calendar` domain module with types and validation only. The module consumes the Phase 1 institution profile model and validates tenant-scoped academic years, periods, windows, transcript periods, and subdivisions without adding database, API, UI, LMS, or ShepherdAI runtime behavior.

**Tech Stack:** TypeScript, node:test, existing Academy institution configuration types.

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

Data touched: TypeScript domain model and tests only.

LMS impact: none at runtime. Types preserve future provider-neutral calendar and subdivision references.

Student PWA impact: none at runtime. Types preserve future schedule, grade-band, cohort, and period references.

ShepherdAI impact: none at runtime. Validation messages establish future deterministic setup signals.

Security/privacy impact: every model carries `tenantId`; route and write enforcement remain future work under ADR 0003.

## Files

- Create: `src/modules/academic-calendar/types.ts`
- Create: `src/modules/academic-calendar/validation.ts`
- Create: `src/modules/academic-calendar/__tests__/academic-calendar-validation.test.ts`
- Create: `docs/superpowers/plans/2026-06-01-phase-2-sprint-2-calendar-subdivision-types-validation.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Validation Tests

- [x] Add tests for a valid college academic year with term, registration, grading, and transcript periods.
- [x] Add tests for Bible school rolling enrollment modules, completion records, and cohorts.
- [x] Add tests for children's school grade-band requirements.
- [x] Add tests for overlapping academic years scoped by subdivision.
- [x] Add tests for invalid period, enrollment window, grading window, and transcript period dates.
- [x] Add tests for transcript-bearing institutions requiring transcript periods.
- [x] Add tests for mixed institutions requiring mode-scoped branches.
- [x] Run the focused test and confirm failure because the module does not exist.

### Task 2: Types

- [x] Create academic calendar profile, year, period, enrollment window, grading window, transcript period, and subdivision types.
- [x] Reuse Phase 1 institution configuration types for calendar system, term structure, institution mode, and official record names.
- [x] Keep the type surface persistence-neutral.

### Task 3: Validation

- [x] Validate tenant consistency.
- [x] Validate academic year date order and overlap by tenant/subdivision.
- [x] Validate period containment within academic years and parent periods.
- [x] Validate enrollment window date order and registration/add-drop targets.
- [x] Validate grading and transcript posting windows.
- [x] Validate children's school grade-band requirements.
- [x] Validate transcript-bearing institution requirements.
- [x] Validate mixed institution mode-scoped subdivision branches.

### Task 4: Documentation And Verification

- [x] Mark Phase 2 Sprint 2 complete in the factory roadmap.
- [x] Mark calendar/subdivision type and validation items complete in the master implementation plan.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when calendar and subdivision domain types exist with deterministic tests. No database tables, repositories, API routes, UI, LMS adapter behavior, ShepherdAI runtime behavior, or write endpoints belong in this sprint.

## Next Sprint

Phase 2 Sprint 3 should add calendar and subdivision migrations, seeded mock data, and repository read behavior after a separate migration execution package is created.
