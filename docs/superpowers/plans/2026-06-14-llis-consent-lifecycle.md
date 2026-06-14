# LLIS Slice 2: Consent Lifecycle and Evidence Ledger

## Goal

Make learner consent operationally complete before any predictive LLIS
computation is enabled.

## Scope

- read the learner's current consent and version history
- revoke consent with timestamp and learner-supplied reason
- emit immutable audit events for grant, update, and revocation
- expose learner-facing consent controls
- verify RLS against real database actors and consent states
- document retention, deletion, export, and legal-hold behavior

## Non-Goals

- risk scoring
- identity snapshot computation
- intervention recommendation generation
- social graph analysis
- autonomous academic or pastoral decisions

## Delivery Order

1. Add failing service and route tests for consent read and revocation.
2. Add repository methods and audit writes inside the request transaction.
3. Add learner-facing consent controls with accessible explanations.
4. Add database-backed RLS matrix verification.
5. Add retention and deletion policy documentation.
6. Run the complete verification bundle and publish as a separate PR.

## Exit Criteria

- only the learner can grant, change, or revoke consent
- staff cannot bypass revoked consent through API or direct authenticated SQL
- consent history is immutable and tenant-scoped
- protected writes fail after revocation
- tests cover learner, cross-learner, staff, unauthenticated, and cross-tenant
  cases
- build, focused lint, full tests, migration checks, and RLS verification pass

## Delivery Status

Completed on June 14, 2026. The evidence ledger is database-generated so direct
authenticated SQL cannot bypass or forge consent history. The governing
retention policy is recorded in
`docs/policies/llis-data-retention-and-deletion.md`.
