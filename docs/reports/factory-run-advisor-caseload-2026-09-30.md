# Factory Run: Advisor Caseload Intelligence

Date: 2026-09-30
Status: verified, pending PR delivery
Issue: `#203`

## Intent

Deliver an assignment-scoped advising workspace that turns existing Academy student, risk, hold, signal, and note evidence into a usable caseload without creating a parallel student-record system.

## Boundaries

- Academy remains the student and academic system of record.
- No autonomous recommendations, new note mutation path, LMS behavior, messaging, appointment scheduling, or faculty-load implementation.
- ADR-0062 remains proposed; ADR-0076 accepts only this workspace and access model.

## Implementation

- Added a people-domain advising read model with self-caseload and oversight authorization.
- Added `/admin/advising`, advisor selection for oversight roles, prioritized evidence, and links to existing protected workflows.
- Added Registrar navigation, surface registration, deterministic E2E assignment, focused authorization tests, and advisor/registrar journeys.

## Verification

- Focused advising and navigation tests: passed, 6 tests.
- TypeScript `--noEmit`: passed.
- Focused ESLint: passed.
- `npm run verify` on the final code: passed, 2,065 tests, lint, and build.
- `npm run test:full -- --reset-db`: passed, 406 passed and 330 skipped in 7.6 minutes on the final code; both advising journeys and the page sweep passed.
- Council and Testing Council: revise -> fixed locally. The role-blind navigation finding was fixed and covered.
- Local `pr-review`: passed with 0 critical and 0 important findings after the navigation fix.
- Copilot PR review: three important findings, all fixed; the final verification and reset-backed full suite passed after the fixes.
- Copilot follow-up review: two important findings, both fixed. Program progress now loads through one canonical bulk repository query, and E2E proves a known unassigned same-tenant learner is excluded.
- `npm run verify:governance`: passed.
- `git diff --check`: passed.

## Residual Risk

- Risk and signal summaries depend on existing evaluation jobs; absence is displayed as no current evidence, not as proof of low risk.
- This slice shows current assignment state, not advisor-assignment history.
