# Phase 4 Sprint 5 People Persistence Seed Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for persistence and repository behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add people-domain persistence, seed data, and a tenant-scoped repository read path before building the people admin review UI.

**Architecture:** Extend the Phase 4 people domain with Supabase/Postgres storage for people, role assignments, student profiles, staff profiles, student relationships, and account links. Keep this sprint read-oriented and seed-backed. Admin UI, API route payloads, edit flows, account provisioning, LMS adapter behavior, student PWA screens, and ShepherdAI runtime behavior stay out of scope.

**Tech Stack:** TypeScript, node:test, Supabase/Postgres migrations, existing Academy dataset loader and seed scripts.

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

- tenant-scoped people
- role assignments
- student profiles
- staff profiles
- guardian/advisor/staff relationships
- account links without provider secrets

LMS impact: stores provider-neutral account-link references only. No Moodle, Canvas, roster sync, launch, or credential storage behavior is implemented.

Student PWA impact: creates the future read source for student and guardian identity/profile data.

ShepherdAI impact: none at runtime.

Security/privacy impact: tenant-scoped tables, relationship-oriented indexes, no account-link secrets, and repository reads scoped by tenant id.

## Files

- Create: `supabase/migrations/20260602020000_people_roles_relationships.sql`
- Create: `src/modules/people/postgres-repository.ts`
- Create: `src/modules/people/__tests__/people-persistence.test.ts`
- Create: `src/modules/people/__tests__/people-repository.test.ts`
- Modify: `src/modules/academy-data/types.ts`
- Modify: `src/modules/academy-data/mock-data.ts`
- Modify: `src/modules/academy-data/postgres-repository.ts`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Persistence And Repository Tests

- [x] Add migration discovery/order coverage.
- [x] Add people schema/index coverage.
- [x] Add seeded people configuration validation coverage.
- [x] Add row-mapping repository coverage.
- [x] Add tenant-scoped repository fetch coverage.
- [x] Add missing institution profile error coverage.
- [x] Run focused tests and confirm expected failures for missing persistence/repository artifacts.

### Task 2: Postgres Migration

- [x] Add `academy_people`.
- [x] Add `academy_person_role_assignments`.
- [x] Add `academy_student_profiles`.
- [x] Add `academy_staff_profiles`.
- [x] Add `academy_student_relationships`.
- [x] Add `academy_account_links`.
- [x] Add tenant/person/relationship/account indexes for read paths.
- [x] Keep account-link secrets out of the schema.

### Task 3: Seed Data And Dataset Integration

- [x] Add a valid `peopleConfiguration` to the mock Academy dataset.
- [x] Include a children's school student, guardian, teacher, registrar, and advisor.
- [x] Include guardian and assigned-staff relationships.
- [x] Include account links without credentials or tokens.
- [x] Add people configuration to `AcademyDataset`.
- [x] Update dataset load path to map people rows.
- [x] Update seed path to insert/update people rows.

### Task 4: People Repository

- [x] Add people row mappers.
- [x] Add `mapPeopleRows`.
- [x] Add `AcademyPeopleRepository.fetchPeopleConfiguration`.
- [x] Scope every query by `tenant_id = $1`.
- [x] Reuse the existing institution profile row mapper.

### Task 5: Roadmap And Master Plan Updates

- [x] Mark Phase 4 Sprint 5 as complete in the factory roadmap.
- [x] Move people and role admin review UI to Phase 4 Sprint 6.
- [x] Mark People And Roles Postgres persistence and seed data complete in the master implementation plan.

### Task 6: Verification

- [x] Run focused people persistence and repository tests.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when the people domain has tenant-scoped persistence, valid seed data, and a repository read path that future APIs and review UI can consume.

No admin UI, API route, edit flow, account provisioning, LMS adapter behavior, student PWA screen, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

Phase 4 Sprint 6 should build the people and role admin review UI against `AcademyPeopleRepository`, with validation warnings and relationship/privacy summaries visible to administrators.
