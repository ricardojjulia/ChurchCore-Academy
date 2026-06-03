# Phase 4 Sprint 3 Guardian Relationship Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for guardian relationship behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the people domain with guardian relationship access semantics, contact-only privacy validation, and deterministic guardian visibility tests.

**Architecture:** Extend the existing `src/modules/people/` validation module with guardian-specific access helpers and relationship privacy checks. This sprint does not add persistence, seed data, repositories, APIs, UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior.

**Tech Stack:** TypeScript, node:test, existing Academy institution config types and auth role names.

---

## Factory Intake

Product area: Guardian Relationships, Student Visibility, People Privacy, and Children's School Readiness.

Institution modes affected:

- children's school
- mixed institution
- Bible school, seminary, college, and university where guardian or sponsor-style relationships may be configured later

Data touched:

- no database tables
- no seed data changes
- TypeScript validation and guardian access helper only

LMS impact: none. Guardian eligibility may be consumed by future LMS launch rules, but no provider runtime logic is introduced.

Student PWA impact: adds deterministic guardian category access semantics for future PWA read models.

ShepherdAI impact: future setup-gap signals can reuse validation warnings; no recommendation runtime changes.

Security/privacy impact: validates guardian role scope matching, expired relationship denial, emergency/pickup contact limits, and billing exclusion.

## Files

- Create: `src/modules/people/__tests__/guardian-relationship.test.ts`
- Create: `docs/superpowers/plans/2026-06-02-phase-4-sprint-3-guardian-relationship-model.md`
- Modify: `src/modules/people/validation.ts`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Guardian Relationship Tests

- [x] Add full guardian access coverage for directory, schedule, documents, progress, and grades.
- [x] Add billing exclusion coverage.
- [x] Add expired relationship denial coverage.
- [x] Add guardian role scope-to-student relationship matching coverage.
- [x] Add emergency contact authority and visibility privacy coverage.
- [x] Add pickup contact authority and visibility privacy coverage.
- [x] Run the focused guardian test and confirm failure for missing helper and missing validations.

### Task 2: Guardian Access Helper

- [x] Add `GuardianAccessCategory`.
- [x] Add `GuardianAccessRequest`.
- [x] Add `canGuardianAccessStudentCategory`.
- [x] Require active guardian role scoped to the requested student.
- [x] Require active guardian relationship for the requested student and guardian.
- [x] Apply relationship visibility category rules.
- [x] Exclude billing from guardian visibility.
- [x] Deny expired or inactive relationships.

### Task 3: Guardian Relationship Privacy Validation

- [x] Validate guardian role scope matches the active related student relationship.
- [x] Reject emergency contacts with academic or registration decision authority.
- [x] Reject pickup contacts without pickup or no authority.
- [x] Reject contact-only relationships with guardian-level visibility.
- [x] Preserve existing child guardian, tenant scope, staff role, advisor, and account-link validation behavior.

### Task 4: Roadmap And Master Plan Updates

- [x] Mark Phase 4 Sprint 3 as complete in the factory roadmap.
- [x] Keep persistence, seed data, API access patterns, admin UI, LMS adapters, student PWA, and ShepherdAI runtime unchecked for future sprints.

### Task 5: Verification

- [x] Run the focused guardian relationship test.
- [x] Run the focused people validation test.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when guardian relationship category access and contact-only privacy rules are deterministic, tested, and reusable by future student PWA/API work.

No persistence, seed data, repository, API route, admin UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

Phase 4 Sprint 4 should add role-scoped API access patterns for the people domain, using these relationship and guardian access rules as policy inputs.
