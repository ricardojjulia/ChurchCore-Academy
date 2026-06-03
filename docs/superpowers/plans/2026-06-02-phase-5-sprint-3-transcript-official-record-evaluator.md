# Phase 5 Sprint 3 Transcript Rule Evaluator And Official Record Evaluator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for evaluator behavior and superpowers:verification-before-completion before delivery. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a deterministic transcript and official-record evaluator that converts approved evaluation results into official-record entries and aggregate summaries for GPA, credits, clock hours, progress, completion, holds, and release posture.

**Architecture:** Add a pure `src/modules/grading-records/official-record-evaluator.ts` module. It consumes the Phase 5 grading-records configuration and evaluation-result inputs, returns entries, summary totals, and warnings, and does not persist records or expose an API/UI. Later repository, API, admin UI, student PWA, LMS adapter, and ShepherdAI slices should call this evaluator instead of duplicating official-record logic.

**Tech Stack:** TypeScript, node:test, existing Academy grading-records types.

---

## Factory Intake

Product area: Grading, transcripts, progress records, completion records, graduation audit readiness, and official academic records.

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

LMS impact: LMS grade-return results are not official records until Academy approval. Direct LMS-to-official-record posting remains forbidden by validation and this evaluator only posts `approved_for_posting` results.

Student PWA impact: evaluator marks guardian visibility, released entries, held entries, transcript inclusion, progress inclusion, completion inclusion, and graduation-audit inclusion for future PWA read models.

ShepherdAI impact: future recommendations can consume evaluator warnings and summary gaps, but this sprint adds no ShepherdAI runtime behavior.

Security/privacy impact: evaluator enforces tenant match, active rule-set lookup, active official-record rule lookup, approval-before-posting, registrar/manual hold posture, and guardian-visible release flags.

## Files

- Create: `src/modules/grading-records/official-record-evaluator.ts`
- Create: `src/modules/grading-records/__tests__/official-record-evaluator.test.ts`
- Create: `docs/superpowers/plans/2026-06-02-phase-5-sprint-3-transcript-official-record-evaluator.md`
- Modify: `docs/product/factory-roadmap.md`
- Modify: `docs/superpowers/plans/2026-06-01-faith-based-academy-master-plan.md`

## Tasks

### Task 1: Failing Evaluator Tests

- [x] Add a college transcript test for approved letter-grade results, transcript entries, credit totals, and GPA.
- [x] Add a Bible school completion-record test for pass/fail completion and clock-hour totals without GPA.
- [x] Add a children's school progress-record test for narrative progress and guardian-visible release posture.
- [x] Add a seminary/college hold test for manual transcript holds.
- [x] Add an LMS grade-return test that skips unapproved submitted results.
- [x] Run the focused test and confirm failure for the missing evaluator module.

### Task 2: Evaluator Contract

- [x] Add typed evaluation-result input.
- [x] Add typed official-record entry output.
- [x] Add typed official-record summary output.
- [x] Add warning output for skipped or invalid inputs.

### Task 3: Evaluator Behavior

- [x] Require tenant match.
- [x] Require active evaluation rule set.
- [x] Require `approved_for_posting` before official-record posting.
- [x] Require active official-record rule for the institution mode and record type.
- [x] Resolve scale bands from explicit band id or numeric raw value.
- [x] Derive official record value from scale band, narrative, or competency result posture.
- [x] Calculate GPA from GPA-included entries and attempted credits.
- [x] Calculate credit totals and clock-hour totals by rule-set policy.
- [x] Mark transcript, progress, completion, promotion, and graduation-audit inclusion flags.
- [x] Mark guardian-visible release posture.
- [x] Mark manual-hold entries as held instead of posted.

### Task 4: Roadmap And Master Plan Updates

- [x] Mark Phase 5 Sprint 3 as complete in the factory roadmap.
- [x] Split the master-plan evaluator task so transcript/official-record evaluation is complete while academic standing, promotion, and graduation evaluation remain future work.
- [x] Keep persistence, seed data, API routes, admin UI, LMS adapters, student PWA, ShepherdAI runtime, academic standing, promotion, and graduation evaluators unchecked for future sprints.

### Task 5: Verification

- [x] Run focused official-record evaluator tests.
- [x] Run `npm audit`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Review Boundary

This sprint is complete when approved evaluation results can be deterministically evaluated into official-record entries, GPA/credit/hour summaries, release posture, and warning output across college, Bible school, children's school, and LMS review scenarios.

No persistence, seed data, repository, API route, admin UI, LMS adapter behavior, student PWA behavior, academic standing evaluator, promotion evaluator, graduation evaluator, or ShepherdAI runtime behavior is included in this sprint.

## Next Sprint

Phase 5 Sprint 4 should add the deterministic academic standing, promotion, and graduation evaluator that consumes official-record summaries and standing rules. It should still avoid persistence, API routes, UI, LMS adapter behavior, student PWA behavior, and ShepherdAI runtime behavior unless the sprint is explicitly expanded.
