# Factory Run: OneRoster Deletion Reconciliation

Date: 2026-09-30
Status: verified, pending PR delivery
Issue: `#164`

## Intent

Remove stale LMS classes and users safely when Academy sections are archived/cancelled or students depart, without sending deletions for records a destination never received.

## Boundaries

- Academy remains the academic and roster system of record.
- Existing OneRoster 1.2 CSV delta and selected-section boundaries remain in force.
- No bulk omission semantics, LMS apply behavior, identity provisioning, REST pull, or production activation.
- Delivery state is tenant-, destination-, and section-scoped and contains only the approved roster subset.

## Implementation

- Added private forced-RLS delivery state for users, roles, classes, and enrollments.
- Added reconciliation that suppresses never-delivered deletions and creates tombstones from prior delivered payloads when records leave the current set.
- Made archived/cancelled sections and inactive/withdrawn roster participants reachable as deletion candidates.
- Advanced manual state after ZIP construction and scheduled state only after a confirmed receiver response.
- Added ADR-0075 and updated the OneRoster operations runbook and canonical backlog.

## Verification

- Focused OneRoster and cron tests: passed, 35 tests.
- TypeScript `--noEmit`: passed.
- Focused ESLint: passed.
- `npm run verify`: passed on the final code, including 2,058 tests, lint, and production build.
- `npm run verify:governance`: passed.
- `git diff --check`: passed.
- `npm run test:full -- --reset-db`: passed before the final dual-role fix, 403 passed and 329 skipped; database reset applied `20260930090000_oneroster_delivery_state.sql`.
- `npm run test:full`: passed on the final code, 403 passed and 329 skipped in 7.5 minutes; both OneRoster API sweep entries passed.
- Council and Testing Council: revise -> fixed locally. Five read-only agent attempts hit the account usage limit before producing findings, so their attempts are not counted as evidence; the manual synthesis is recorded in `docs/reviews/2026-09-30-council-review-20-oneroster-deletion-reconciliation-synthesis.md`.
- Local `pr-review`: passed with 0 critical and 0 important findings after fixing confirmation-boundary coverage and dual-role user status.

## Residual Risk

- Manual issuance cannot prove that an operator imported the downloaded ZIP; it intentionally uses a separate destination ledger.
- Production LMS activation and sandbox evidence remain external gates.
