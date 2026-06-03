# Phase 2 Sprint 4 Calendar Configuration API Read Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for route behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the tenant-scoped academic calendar configuration through an authorized read-only API route.

**Architecture:** Reuse the Phase 2 academic-calendar repository and validation model behind a Next.js App Router GET endpoint. The API follows the existing institution configuration access boundary because calendar setup is institution administration.

**Tech Stack:** Next.js App Router, TypeScript, node:test, existing Academy auth policy, existing academic-calendar repository.

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
- read-only API payload over existing tenant-scoped academic calendar configuration

LMS impact: none at runtime. The response exposes stable period and subdivision identifiers for future provider-neutral LMS mapping.

Student PWA impact: none at runtime. The response prepares future student schedule, term, cohort, and registration read models.

ShepherdAI impact: none at runtime. The response includes validation warnings that future deterministic setup-gap review can reuse.

Security/privacy impact: route is tenant-scoped and restricted to institution configuration readers: institution admin, dean, registrar, and academic admin.

## Files

- Create: `src/app/api/academy/config/calendar/route.ts`
- Create: `src/app/api/academy/config/calendar/__tests__/route.test.ts`
- Create: `docs/superpowers/plans/2026-06-01-phase-2-sprint-4-calendar-config-api-read-path.md`
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

- [x] Add `buildAcademicCalendarConfigPayload`.
- [x] Reuse `assertInstitutionConfigAccess(actor, tenantId, "read")`.
- [x] Load calendar configuration through `AcademyCalendarRepository`.
- [x] Return `{ academicCalendar, validation }`.
- [x] Add `GET` route at `/api/academy/config/calendar`.

### Task 3: Verification

- [x] Run the focused calendar config API test.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Verify allowed and denied API responses against the local dev server.

## Review Boundary

This sprint is complete when authorized staff can read the tenant academic calendar configuration through the API and denied actors are rejected before repository access.

No calendar editing, UI, audit trail, LMS adapter behavior, ShepherdAI runtime behavior, or student PWA workflow is included in this sprint.

## Next Sprint

Phase 2 Sprint 5 should add the admin calendar review UI so institution administrators and registrars can inspect academic years, periods, windows, transcript readiness, and subdivisions before editable calendar workflows are introduced.
