# Council Review 20 - OneRoster Deletion Reconciliation

Date: 2026-09-30
Branch: `fix/oneroster-deletion-reconciliation`
Scope: Current diff only - OneRoster delivery state, deletion reconciliation, export and delivery routes, migration, tests, ADR, and operations documentation.
Decision requested: ship / revise / defer / split / reject

## Executive Verdict

Decision: **revise -> fixed locally**
Release status: not merged, deployed, activated, or externally validated.
Confidence: high for local reconciliation and tenant isolation; production readiness still depends on PR review, hosted migration, and LMS sandbox evidence.

The change closes the stale-roster gap without introducing OneRoster `bulk` omission semantics. Academy records only the active records successfully issued to each tenant, destination, and selected section. Later exports may emit `tobedeleted` rows only for records that destination previously received.

Five read-only Council agents were started for independent review. Each stopped before producing findings because the agent account usage limit was reached. The implementation therefore received a documented manual Council and Testing Council review across the same required lenses; the failed agent starts are not counted as review evidence.

## Evidence Reviewed

- `src/modules/oneroster-contract/delivery-state.ts`
- `src/modules/oneroster-contract/academy-export.ts`
- `src/modules/oneroster-contract/delivery.ts`
- manual package and scheduled delivery routes
- `supabase/migrations/20260930090000_oneroster_delivery_state.sql`
- focused OneRoster export, reconciliation, delivery, and cron tests
- ADR-0075, the OneRoster operations runbook, changelog, and factory run record

## Council Role Findings

### SIS, Data, API, And Security

The ledger is tenant-, destination-, scope-, record-type-, and sourced-ID-scoped, uses forced RLS, and revokes direct anonymous and authenticated access. Reconciliation preserves the selected-section boundary, stores only the approved roster payload subset, and prevents a destination from receiving a deletion for a record it never received.

### OneRoster Contract And Lifecycle

Archived or cancelled sections now produce class and enrollment tombstones after prior delivery. Inactive or withdrawn students produce user and role tombstones after prior delivery. Active users remain tracked when a class closes, allowing a later student departure to be reconciled without repeating class or enrollment deletions.

### Delivery Reliability And Operations

Manual downloads use an isolated `manual-download` destination and advance state only after ZIP construction. Scheduled delivery advances state only after a signed receiver response confirms `validated` or `duplicate`. Production activation, receiver behavior, and sandbox evidence remain outside this change.

### Product And Boundary Review

Academy remains the roster system of record. The implementation does not add LMS runtime behavior, identity provisioning, REST pull, `bulk` mode, or cross-repository changes. Existing OneRoster 1.2 CSV and delta-only boundaries remain intact.

### Testing Council

Coverage proves first-delivery suppression of deletion rows, later tombstone generation, no repetition after reconciliation, destination isolation, archived-section behavior, departed-student behavior, and confirmation-gated state advancement. Migration rehearsal and the complete API/page suite exercise the new table and both delivery routes.

## Fixed Findings

1. **Scheduled state advancement was coupled to delivery success but not directly observable in a regression test.** Fixed by adding an `onConfirmed` callback at the signed receiver-confirmation boundary and tests proving it is not called on receiver failure and is called once on success.
2. **A withdrawn student who remained active faculty could be emitted as a deleted user.** Fixed by evaluating all exported personas before setting user status and adding a dual-role regression test.

## Verification

- Focused OneRoster and cron suite - passed, 35 tests.
- `npx tsc --noEmit` - passed.
- Focused ESLint - passed.
- `npm run verify` - passed on the final code: 2,058 tests, lint, and production build.
- `npm run verify:governance` - passed.
- `git diff --check` - passed.
- `npm run test:full -- --reset-db` - passed before the final dual-role fix, 403 passed and 329 skipped; database reset applied `20260930090000_oneroster_delivery_state.sql`.
- `npm run test:full` - passed on the final code, 403 passed and 329 skipped in 7.5 minutes; the OneRoster package and delivery API sweep entries passed.
- Local `pr-review` - passed with 0 critical and 0 important findings after both fixes.

## Required Before Merge

- Open a PR and wait for required checks and review-thread resolution.
- Apply the migration in the target environment before enabling delivery.

## Residual Risk

- A manual ZIP download proves issuance, not that an operator imported the file. Its state is intentionally isolated from automated destinations.
- A hosted LMS receiver and real roster lifecycle still require sandbox validation before production activation.

## Decision

Council decision is **revise -> fixed locally**. The branch may proceed to PR delivery; it is not authorized for deployment or production OneRoster activation.
