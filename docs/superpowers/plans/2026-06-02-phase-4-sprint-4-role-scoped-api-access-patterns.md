# Phase 4 Sprint 4 Role-Scoped API Access Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for access-policy behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable people-domain access policy patterns for future APIs without adding persistence, routes, or UI.

**Architecture:** Add a focused `src/modules/people/access-policy.ts` module that evaluates tenant match, active people-domain role assignments, student self access, guardian relationship access, assigned-student staff access, and write/admin boundaries. Future people APIs can call this policy before repository access, matching the existing institution configuration route pattern.

**Tech Stack:** TypeScript, node:test, existing Academy auth actor, people types, and guardian access helper.

---

## Factory Intake

Product area: People Directory, Role Boundaries, Guardian Relationships, Faculty/Teacher Assignment, and API Authorization.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched:

- no database tables
- no seed data changes
- no API route
- reusable TypeScript access policy and tests only

LMS impact: none. Future LMS roster/launch APIs can reuse people permissions but this sprint does not implement provider behavior.

Student PWA impact: adds future-ready student and guardian read-access policy semantics.

ShepherdAI impact: none at runtime.

Security/privacy impact: denies cross-tenant access before role evaluation, requires active matching role assignments, limits guardian access through relationship visibility, and keeps write/admin permissions narrow.

## Files

- Create: `src/modules/people/access-policy.ts`
- Create: `src/modules/people/__tests__/access-policy.test.ts`
- Create: `docs/superpowers/plans/2026-06-02-phase-4-sprint-4-role-scoped-api-access-patterns.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Access Policy Tests

- [x] Add institution administrator people admin/write coverage.
- [x] Add cross-tenant denial coverage before role evaluation.
- [x] Add active matching role assignment requirement coverage.
- [x] Add student self-read coverage.
- [x] Add guardian relationship category coverage.
- [x] Add assigned advisor and instructional staff student-read coverage.
- [x] Add write boundary coverage for student records and people administration.
- [x] Run the focused access-policy test and confirm failure for the missing module.

### Task 2: People Access Policy

- [x] Add `PeopleAccessAction`.
- [x] Add `PeopleAccessRequest`.
- [x] Add `canAccessPeopleDomain`.
- [x] Add `assertPeopleAccess`.
- [x] Require actor tenant, requested tenant, and configuration tenant to match.
- [x] Require active matching people-domain role assignments.
- [x] Allow institution administrators to administer and write people.
- [x] Allow registrar/admissions student writes without broad people administration.
- [x] Allow students to read only their own student record.
- [x] Allow guardians to read relationship-visible student categories.
- [x] Allow advisors and instructional staff to read assigned students only.

### Task 3: Roadmap And Master Plan Updates

- [x] Mark Phase 4 Sprint 4 as complete in the factory roadmap.
- [x] Mark role-scoped permissions for Academy routes and APIs complete in the master implementation plan.
- [x] Keep persistence, seed data, API routes, admin UI, LMS adapters, student PWA, and ShepherdAI runtime unchecked for future sprints.

### Task 4: Verification

- [x] Run the focused access-policy test.
- [x] Run the focused guardian relationship test.
- [x] Run the focused people validation test.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when future people APIs have a reusable, tested access policy that can be called before repository access.

No persistence, seed data, repository, API route, admin UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

Phase 4 Sprint 5 should add the people and role admin review UI only after a read source is available. If persistence is preferred before UI, insert a Phase 4 Sprint 4.5/5 migration and repository slice before the admin review UI.
