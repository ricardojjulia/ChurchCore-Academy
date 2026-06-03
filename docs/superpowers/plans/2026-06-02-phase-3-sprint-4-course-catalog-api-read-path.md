# Phase 3 Sprint 4 Course Catalog API Read Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for route behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the tenant-scoped course catalog configuration through an authorized read-only API route.

**Architecture:** Reuse the Phase 3 course-catalog repository and validation model behind a Next.js App Router GET endpoint. The API follows the existing institution configuration access boundary because catalog setup is institution administration.

**Tech Stack:** Next.js App Router, TypeScript, node:test, existing Academy auth policy, existing course-catalog repository.

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

- no new database tables
- no seed data changes
- read-only API payload over existing tenant-scoped course catalog configuration

LMS impact: none at runtime. The response exposes provider-neutral LMS mapping references for future LMS contract and adapter work.

Student PWA impact: none at runtime. The response prepares future student schedule, course, and LMS launch read models.

ShepherdAI impact: none at runtime. The response includes validation warnings that future deterministic setup-gap review can reuse.

Security/privacy impact: route is tenant-scoped and restricted to institution configuration readers: institution admin, dean, registrar, and academic admin.

## Files

- Create: `src/app/api/academy/config/courses/route.ts`
- Create: `src/app/api/academy/config/courses/__tests__/route.test.ts`
- Create: `docs/superpowers/plans/2026-06-02-phase-3-sprint-4-course-catalog-api-read-path.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing API Tests

- [x] Add route payload tests for authorized same-tenant readers.
- [x] Add denial tests for student role access.
- [x] Add denial tests for cross-tenant access.
- [x] Add validation warning payload coverage.
- [x] Run the focused test and confirm failure for the missing route module.

### Task 2: Read Path Route

- [x] Add `buildCourseCatalogConfigPayload`.
- [x] Reuse `assertInstitutionConfigAccess(actor, tenantId, "read")`.
- [x] Load course catalog configuration through `AcademyCourseCatalogRepository`.
- [x] Return `{ courseCatalog, validation }`.
- [x] Add `GET` route at `/api/academy/config/courses`.

### Task 3: Verification

- [x] Run the focused course catalog config API test.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Verify allowed and denied API responses against the local dev server.

## Review Boundary

This sprint is complete when authorized staff can read the tenant course catalog configuration through the API and denied actors are rejected before repository access.

No course editing, instructor assignment workflow, admin UI, LMS adapter behavior, ShepherdAI runtime behavior, student PWA workflow, or audit trail is included in this sprint.

## Next Sprint

Phase 3 Sprint 5 should add the admin course setup review UI so institution administrators and registrars can inspect course types, sections, duration readiness, instructor readiness, and LMS mapping readiness before editable workflows are introduced.
