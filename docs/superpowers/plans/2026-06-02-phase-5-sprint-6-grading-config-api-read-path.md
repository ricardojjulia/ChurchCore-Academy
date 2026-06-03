# Phase 5 Sprint 6 Grading Configuration API Read Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for API behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a role-scoped API read path for grading-records configuration so the future admin review UI can read persisted grading setup from `AcademyGradingRecordsRepository`.

**Architecture:** Add `GET /api/academy/config/grading` using the same API pattern as institution, calendar, and course configuration. The route resolves the Academy actor from request headers, enforces institution configuration read access before repository calls, fetches tenant-scoped grading records configuration, and returns domain validation warnings.

**Tech Stack:** Next.js route handler, TypeScript, node:test, existing Academy auth policy, existing grading-records repository and validation module.

---

## Factory Intake

Product area: grading configuration, official record rules, standing rules, API read path, and admin review readiness.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched:

- API route
- API route tests
- no new database tables
- no seed data changes
- no UI

LMS impact: API exposes provider-neutral `lmsGradeReturnPolicy` and validation warnings for forbidden direct LMS official-record posting. It does not call Moodle, Canvas, or any LMS provider.

Student PWA impact: none directly. This is admin configuration read infrastructure only.

ShepherdAI impact: none directly. Future recommendations can use this read path or repository to inspect grading configuration gaps.

Security/privacy impact: route uses `assertInstitutionConfigAccess` before repository access and rejects cross-tenant and student/guardian reads.

## Files

- Create: `src/app/api/academy/config/grading/route.ts`
- Create: `src/app/api/academy/config/grading/__tests__/route.test.ts`
- Create: `docs/superpowers/plans/2026-06-02-phase-5-sprint-6-grading-config-api-read-path.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing API Tests

- [x] Add authorized same-tenant read test.
- [x] Add denied-role test that verifies repository is not called.
- [x] Add cross-tenant test that verifies repository is not called.
- [x] Add validation-warning test for invalid grading configuration.
- [x] Run focused test and confirm failure for the missing route module.

### Task 2: Route Handler

- [x] Add `GradingRecordsConfigReader` interface.
- [x] Add `buildGradingRecordsConfigPayload`.
- [x] Enforce `assertInstitutionConfigAccess(actor, tenantId, "read")`.
- [x] Fetch through `AcademyGradingRecordsRepository`.
- [x] Return `{ gradingRecords, validation }`.
- [x] Add `GET` handler using `resolveBootstrapAcademyActor`.

### Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 5 Sprint 6 as complete in the factory roadmap.
- [x] Add and mark grading configuration API read path complete in the master implementation plan.
- [x] Keep admin review UI unchecked for the next sprint.

### Task 4: Verification

- [x] Run focused grading configuration API tests.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when authorized Academy staff can read persisted grading configuration through the API payload builder and route, and unauthorized/cross-tenant actors are rejected before repository access.

No admin review UI, write API, persistence changes, LMS adapter behavior, student PWA behavior, transcript document generation, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

Phase 5 Sprint 7 should add the Admin Grading Review UI backed by this API/repository read path. It should show grading profile posture, scales, rule sets, official record rules, standing rules, and validation warnings without allowing edits yet.
