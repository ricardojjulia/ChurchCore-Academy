# Phase 4 Sprint 2 Person And Relationship Types With Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for validation behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first runtime people-domain slice: person, role assignment, student profile, staff profile, student relationship, account-link types, and deterministic validation tests.

**Architecture:** Add a focused `src/modules/people/` domain module that depends on the existing Academy role names and institution profile rules. This sprint does not add persistence, seed data, repositories, APIs, UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior.

**Tech Stack:** TypeScript, node:test, existing Academy institution config types and auth role names.

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

- no database tables
- no seed data changes
- TypeScript domain types and validation only

LMS impact: account links are identifiers only and explicitly reject provider secrets or tokens.

Student PWA impact: future-facing type and validation support for student self-access and guardian relationship-scoped access; no PWA route is added.

ShepherdAI impact: future-facing setup-gap validation only; no recommendation runtime changes.

Security/privacy impact: validation covers tenant scope, active role coupling, guardian relationship backing, instructional role readiness, advisor eligibility, and provider secret exclusion.

## Files

- Create: `src/modules/people/types.ts`
- Create: `src/modules/people/validation.ts`
- Create: `src/modules/people/__tests__/people-validation.test.ts`
- Create: `docs/superpowers/plans/2026-06-02-phase-4-sprint-2-person-relationship-types-validation.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Validation Tests

- [x] Add a valid children's school people configuration with a child student, guardian, guardian relationship, teacher role, and staff profile.
- [x] Add tenant-scope rejection coverage.
- [x] Add student profile and active student role coupling coverage.
- [x] Add required child guardian relationship coverage.
- [x] Add guardian role relationship-scoping coverage.
- [x] Add instructional staff active role coverage.
- [x] Add advisor-capable role coverage.
- [x] Add account-link provider secret rejection coverage.
- [x] Run the focused test and confirm failure for the missing people validation module.

### Task 2: People Types

- [x] Add `Person`.
- [x] Add `PersonRoleAssignment`.
- [x] Add `StudentProfile`.
- [x] Add `StaffProfile`.
- [x] Add `StudentRelationship`.
- [x] Add `AccountLink`.
- [x] Add `PeopleConfiguration`.

### Task 3: People Validation

- [x] Validate tenant scope for all people-domain records.
- [x] Validate person references and display names.
- [x] Validate student profiles require active student role assignments.
- [x] Validate child student guardian requirements when institution rules require guardians.
- [x] Validate guardian roles are student-scoped and backed by active relationships.
- [x] Validate staff profiles require active matching staff/instructional role assignments.
- [x] Validate student advisor references use advisor-capable roles.
- [x] Validate account links do not store provider secrets or tokens.

### Task 4: Roadmap And Master Plan Updates

- [x] Mark Phase 4 Sprint 2 as complete in the factory roadmap.
- [x] Mark people type expansion and relevant validation coverage complete in the master implementation plan.
- [x] Leave persistence, seed data, API access patterns, admin UI, LMS adapters, student PWA, and ShepherdAI runtime unchecked for future sprints.

### Task 5: Verification

- [x] Run the focused people validation test.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when the people domain has typed runtime contracts and deterministic validation tests for tenant scope, role/profile coupling, guardian relationship privacy, instructional readiness, advisor eligibility, and account-link secret exclusion.

No persistence, seed data, repository, API route, admin UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

Phase 4 Sprint 3 should add the guardian relationship model details, privacy-oriented validation expansion, and seed-ready relationship scenarios before persistence work starts.
