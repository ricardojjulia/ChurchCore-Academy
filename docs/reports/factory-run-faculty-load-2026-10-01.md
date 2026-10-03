# Factory Run: Faculty Teaching-Load Intelligence

Date: 2026-10-01
Status: verified, pending PR delivery
Issue: `#205`

## Intent

Deliver the approved faculty-load slice as a period-scoped administrative workspace over normalized Academy records.

## Boundaries

- Academy remains the academic and staffing system of record.
- Read-only operational evidence; no faculty ranking, evaluation, compensation, contract/FTE calculation, schedule inference, automatic reassignment, LMS behavior, or deployment.
- Current primary-instructor assignments only; assistant-instructor accounting is deferred.

## Implementation

- Added a people-domain faculty-load read model bound to actor tenant and selected academic period.
- Expanded the legacy suggestion-only faculty page with teaching, enrollment, capacity, advising, and explainable review evidence.
- Preserved the existing ShepherdAI faculty-alert and workflow panels for academic administrators as an additive secondary section.
- Added oversight-role navigation gating, surface registration, focused tests, and an academic-administrator browser journey.
- Accepted ADR-0077.

## Verification

- Focused module and navigation tests: passed, 6 tests.
- TypeScript `--noEmit`: passed.
- Focused ESLint: passed.
- `npm run verify`: passed, 2,071 tests, lint, and build.
- `npm run test:full -- --reset-db`: passed, 408 passed and 330 skipped in 7.6 minutes on the final code.
- Council and Testing Council: revise -> partially fixed before merge. Cross-tenant surface expectations were corrected, but incomplete aggregate presentation and primary-path E2E remained open after PR `#206` and were later assigned to issue `#216`.
- Local `pr-review`: passed with 0 critical and 0 important findings after the corrections.
- Copilot review: two important findings, both fixed locally. Dashboard and sidebar Faculty links now share the oversight-role boundary, and faculty eligibility honors role assignment effective dates.
- `npm run verify:governance`: passed.
- `git diff --check`: passed.
- Remaining gates: protected PR checks and Copilot review.

## Residual Risk

- Course credits, clock hours, capacity, and staff load policies are institution-configured and may be absent.
- Free-text schedule patterns cannot support reliable collision detection.

## 2026-10-02 Follow-Up

PR `#206` merged with three later-round Copilot findings unresolved: partial
credit/hour totals, partial capacity denominators, and browser coverage limited to
a zero-section faculty record. Issue `#216` owns and verifies that correction.
