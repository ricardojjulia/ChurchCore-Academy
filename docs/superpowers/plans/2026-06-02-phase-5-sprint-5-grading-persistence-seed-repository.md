# Phase 5 Sprint 5 Grading Persistence Seed Data And Repository Read Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for persistence and repository behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist grading-records configuration, seed a valid faith-based Academy grading setup, and provide a repository read path for later API and admin review UI work.

**Architecture:** Add tenant-scoped Postgres tables for grading profile, evaluation scales, scale bands, evaluation rule sets, official record rules, and academic standing rules. Extend the canonical mock dataset and local seeder so Academy can seed grading configuration alongside institution, calendar, course, and people data. Add `AcademyGradingRecordsRepository` to map rows back into `GradingRecordsConfiguration`.

**Tech Stack:** TypeScript, node:test, Supabase/Postgres migration SQL, existing Academy data seeding pattern.

---

## Factory Intake

Product area: grading records, official records, academic standing, persistence, seed data, and repository read path.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched:

- Postgres schema migration
- mock Academy seed data
- central Academy dataset load/seed repository
- grading-records repository mapper and read path
- persistence/repository tests
- no API route
- no UI

LMS impact: persisted rule sets include provider-neutral LMS grade-return policy. Seed data keeps `manual_entry_only`, and validation still rejects direct LMS official-record posting.

Student PWA impact: persisted official-record and standing rules provide the future source for student/guardian progress, completion, standing, and graduation readiness read models.

ShepherdAI impact: persisted grading configuration enables future deterministic signals for grade-rule gaps, standing blockers, and graduation readiness gaps. This sprint adds no ShepherdAI runtime behavior.

Security/privacy impact: all grading tables are tenant scoped; official-record and standing rules stay separate from raw evaluations; provider secrets are not stored.

## Files

- Create: `supabase/migrations/20260602030000_grading_records.sql`
- Create: `src/modules/grading-records/postgres-repository.ts`
- Create: `src/modules/grading-records/__tests__/grading-records-persistence.test.ts`
- Create: `src/modules/grading-records/__tests__/grading-records-repository.test.ts`
- Create: `docs/superpowers/plans/2026-06-02-phase-5-sprint-5-grading-persistence-seed-repository.md`
- Modify: `src/modules/academy-data/types.ts`
- Modify: `src/modules/academy-data/mock-data.ts`
- Modify: `src/modules/academy-data/postgres-repository.ts`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Persistence And Repository Tests

- [x] Add migration discovery test after people migration.
- [x] Add migration shape test for grading profile, scales, scale bands, rule sets, official record rules, and standing rules.
- [x] Add seeded mock dataset validation test.
- [x] Add row mapper test for a college GPA transcript configuration.
- [x] Add repository read-path test for tenant-scoped queries.
- [x] Add missing grading profile error test.
- [x] Run focused tests and confirm failure for missing migration, seed data, and repository module.

### Task 2: Migration

- [x] Add `academy_grading_profiles`.
- [x] Add `academy_evaluation_scales`.
- [x] Add `academy_evaluation_scale_bands`.
- [x] Add `academy_evaluation_rule_sets`.
- [x] Add `academy_official_record_rules`.
- [x] Add `academy_academic_standing_rules`.
- [x] Add tenant/read indexes for scale, rule-set, official-record, and standing-rule review paths.

### Task 3: Seed Data

- [x] Extend `AcademyDataset` with `gradingRecords`.
- [x] Add valid mixed/Bible-school-compatible mock grading records configuration.
- [x] Seed grading profile, scales, scale bands, rule sets, official record rules, and standing rules.
- [x] Load grading records configuration in `AcademyDataRepository.loadDataset`.

### Task 4: Repository Read Path

- [x] Add `mapGradingRecordsRows`.
- [x] Add `AcademyGradingRecordsRepository.fetchGradingRecordsConfiguration`.
- [x] Preserve tenant-scoped query filtering.
- [x] Preserve validation compatibility with `validateGradingRecordsConfiguration`.
- [x] Report missing institution profile and missing grading profile errors.

### Task 5: Roadmap And Master Plan Updates

- [x] Mark Phase 5 Sprint 5 as complete in the factory roadmap.
- [x] Mark Postgres persistence and seed data complete in the master implementation plan.
- [x] Keep API route and admin review UI work unchecked for future sprints.

### Task 6: Verification

- [x] Run focused grading-records persistence and repository tests.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when grading-records configuration can be migrated, seeded, mapped, fetched by tenant, and validated through the existing domain rules.

No API route, admin review UI, LMS adapter behavior, student PWA behavior, official evaluation-result persistence, transcript document generation, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

Phase 5 Sprint 6 should add a grading-records API read path that uses `AcademyGradingRecordsRepository`, role-scoped Academy auth, validation warnings, and the deterministic evaluator outputs needed by the later admin review UI.
