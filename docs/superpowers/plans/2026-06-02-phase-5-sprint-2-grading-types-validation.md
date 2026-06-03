# Phase 5 Sprint 2 Grading Type And Scale Types With Validation Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for validation behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first runtime grading-records slice: grading profile, evaluation scale, scale band, evaluation rule set, official record rule, standing rule, and deterministic validation tests.

**Architecture:** Add a focused `src/modules/grading-records/` domain module with TypeScript types and validation only. The module consumes the Phase 1 institution profile model and validates tenant-scoped grading posture without adding persistence, API routes, UI, LMS adapter behavior, student PWA behavior, transcript evaluators, or ShepherdAI runtime behavior.

**Tech Stack:** TypeScript, node:test, existing Academy institution configuration types.

---

## Factory Intake

Product area: Grading, Evaluation, Official Records, Promotion, Graduation, and Academic Standing.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched:

- TypeScript domain types
- deterministic validation only
- no database tables
- no seed data changes
- no API route
- no UI

LMS impact: adds provider-neutral `lmsGradeReturnPolicy` validation and rejects direct official posting from LMS grade return.

Student PWA impact: future-facing release, guardian visibility, progress, and transcript rules only; no PWA route is added.

ShepherdAI impact: future setup-gap validation only; no recommendation runtime changes.

Security/privacy impact: validation covers tenant scope, transcript posting rules, guardian release posture, GPA support, official record rule compatibility, and LMS grade-return boundaries.

## Files

- Create: `src/modules/grading-records/types.ts`
- Create: `src/modules/grading-records/validation.ts`
- Create: `src/modules/grading-records/__tests__/grading-records-validation.test.ts`
- Create: `docs/superpowers/plans/2026-06-02-phase-5-sprint-2-grading-types-validation.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Validation Tests

- [x] Add a valid college GPA transcript configuration test.
- [x] Add a valid Bible school pass/fail completion configuration test.
- [x] Add a valid children's school narrative progress configuration test.
- [x] Add a valid seminary transcript with LMS grade-return review test.
- [x] Add invalid cross-tenant reference tests.
- [x] Add invalid GPA support/policy tests.
- [x] Add invalid overlapping scale band tests.
- [x] Add invalid scale/rule mismatch tests.
- [x] Add missing transcript official record rule test.
- [x] Add forbidden direct LMS official-posting test.
- [x] Run the focused test and confirm failure for the missing module.

### Task 2: Grading Records Types

- [x] Add `GradingProfile`.
- [x] Add `EvaluationScale`.
- [x] Add `EvaluationScaleBand`.
- [x] Add `EvaluationRuleSet`.
- [x] Add `OfficialRecordRule`.
- [x] Add `AcademicStandingRule`.
- [x] Add `GradingRecordsConfiguration`.

### Task 3: Validation

- [x] Add tenant scope validation.
- [x] Validate profile support against institution operating rules.
- [x] Validate child, Bible school, transcript, GPA, credit, clock-hour, competency, and narrative postures.
- [x] Validate scale bands and numeric range overlap.
- [x] Validate rule set scale compatibility and policy compatibility.
- [x] Validate official record rules and standing rules.
- [x] Reject LMS direct official-record posting.

### Task 4: Roadmap And Master Plan Updates

- [x] Mark Phase 5 Sprint 2 as complete in the factory roadmap.
- [x] Mark grading scale, grade band, grade type, GPA rule, pass/fail rule, competency rule, narrative rule, transcript rule, promotion rule, and graduation rule models complete in the master implementation plan.
- [x] Mark configured validation tests for college GPA, pass/fail certificate, competency Bible school, narrative elementary, and seminary transcript configurations complete in the master implementation plan.
- [x] Keep persistence, evaluators, API routes, admin UI, LMS adapters, student PWA, and ShepherdAI runtime unchecked for future sprints.

### Task 5: Verification

- [x] Run focused grading-records validation tests.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when the grading-records domain has typed runtime contracts and deterministic validation tests for tenant scope, institution mode, GPA/non-GPA scale behavior, official record rules, standing rules, and LMS grade-return guardrails.

No persistence, seed data, repository, API route, admin UI, LMS adapter behavior, student PWA behavior, transcript evaluator, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

Phase 5 Sprint 3 should add a deterministic transcript and official-record evaluator. It should consume the grading-records types but should not add persistence, API routes, UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior.
