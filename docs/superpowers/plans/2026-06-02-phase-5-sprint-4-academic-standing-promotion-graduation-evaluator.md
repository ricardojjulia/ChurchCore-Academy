# Phase 5 Sprint 4 Academic Standing Promotion And Graduation Evaluator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for evaluator behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a deterministic academic standing, promotion, and graduation evaluator that consumes posted official records and active standing rules.

**Architecture:** Add a pure `src/modules/grading-records/academic-standing-evaluator.ts` module. It groups official-record entries by student, recomputes per-student GPA, credit, clock-hour, completion, progress, hold, and release summaries from posted records, then applies active `AcademicStandingRule` records for the institution mode. It does not persist standing decisions, expose API routes, add UI, connect LMS providers, or add ShepherdAI runtime behavior.

**Tech Stack:** TypeScript, node:test, existing Academy grading-records types and official-record evaluator outputs.

---

## Factory Intake

Product area: Academic standing, promotion readiness, graduation readiness, graduation blockers, and official academic-record evaluation.

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched:

- TypeScript evaluator module
- deterministic evaluator tests
- no database tables
- no seed data changes
- no API route
- no UI

LMS impact: none directly. The evaluator consumes Academy official records only, so LMS grade-return results must already have passed the Academy approval and official-record evaluator boundary.

Student PWA impact: evaluator produces student-level standing, promotion, graduation-ready, and graduation-blocked flags that future PWA read models can expose after role and release filtering.

ShepherdAI impact: future recommendations can consume standing blockers, missing competencies, graduation holds, and credit/GPA gaps, but this sprint adds no ShepherdAI runtime behavior.

Security/privacy impact: evaluator only applies active same-tenant standing rules for the institution mode and excludes held records from earned totals while treating held records as graduation blockers.

## Files

- Create: `src/modules/grading-records/academic-standing-evaluator.ts`
- Create: `src/modules/grading-records/__tests__/academic-standing-evaluator.test.ts`
- Create: `docs/superpowers/plans/2026-06-02-phase-5-sprint-4-academic-standing-promotion-graduation-evaluator.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Evaluator Tests

- [x] Add a college good-standing test for GPA and credit thresholds.
- [x] Add a probation test for GPA below threshold.
- [x] Add a children's school promotion-ready test for required competency evidence.
- [x] Add a graduation-ready test for GPA, credits, and required completion record.
- [x] Add a graduation-blocked test for missing requirements and held records.
- [x] Run the focused test and confirm failure for the missing evaluator module.

### Task 2: Evaluator Contract

- [x] Add typed standing-rule evaluation output.
- [x] Add typed per-student academic standing output.
- [x] Add typed evaluator input based on official-record evaluator output.
- [x] Preserve official-record warnings for downstream review.

### Task 3: Evaluator Behavior

- [x] Apply only active same-tenant standing rules scoped to the institution mode.
- [x] Group official-record entries by student.
- [x] Recompute GPA, credits, clock hours, completion counts, progress counts, held counts, and released counts per student.
- [x] Exclude held records from earned totals and GPA calculation.
- [x] Evaluate positive readiness rules: good standing, promotion ready, graduation ready.
- [x] Evaluate negative/blocking rules: warning, probation, retention review, graduation blocked.
- [x] Match required competencies from posted promotion, graduation-audit, competency, or progress records.
- [x] Match required completion records from posted completion or graduation-audit records.
- [x] Treat held official records as graduation blockers.

### Task 4: Roadmap And Master Plan Updates

- [x] Mark Phase 5 Sprint 4 as complete in the factory roadmap.
- [x] Mark deterministic academic standing, promotion, and graduation evaluators complete in the master implementation plan.
- [x] Keep persistence, seed data, API routes, admin UI, LMS adapters, student PWA, and ShepherdAI runtime unchecked for future sprints.

### Task 5: Verification

- [x] Run focused academic-standing evaluator tests.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when posted official records can be deterministically evaluated into per-student standing, promotion readiness, graduation readiness, graduation blockers, and human-readable blocker reasons.

No persistence, seed data, repository, API route, admin UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

Phase 5 Sprint 5 should add grading-records persistence, seed data, and repository read path before the admin review UI so the UI reads real Academy grading configuration and evaluator outputs instead of mock-only data.
