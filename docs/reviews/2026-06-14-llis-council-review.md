# Council Review: ChurchCore Living Learner Intelligence System

## Decision

**Conditionally approved for foundation development.**

LLIS is strategically differentiating, but it is not approved for autonomous
prediction, learner labeling, or production intervention generation. The
approved slice is the governed data and API foundation: verified identity,
tenant isolation, explicit learner consent, append-only evidence, explainable
human-reviewed interventions, and auditable status changes.

## Approved Foundation

- consent-gated learner activity event ingestion
- versioned learner consent owned by the learner
- consent-gated learner memory with confidence decay
- identity snapshot and intervention persistence contracts
- staff-only intervention review and status history
- Supabase RLS and request transaction enforcement
- sensitivity-based memory access

## Council Conditions

1. No staff member may grant consent on behalf of a learner.
2. No user-editable JWT metadata may authorize tenant or role access.
3. No predictive artifact may be written without active predictive consent.
4. Negative indicators remain staff-only and must not become learner-visible
   labels without a separate Council decision.
5. Human review is required before an intervention affects an academic or
   pastoral workflow.
6. Every generated recommendation must retain source evidence, model/version
   provenance, confidence, expiry, and reviewer outcome.
7. Pastoral and confidential memory must use narrower access than ordinary
   academic records.

## Implemented In This Slice

- session-derived Academy actors on all LLIS routes
- request-scoped tenant/person database context
- learner-only consent service and RLS policies
- forced RLS on all LLIS tables
- invoker-secure confidence view
- composite tenant-aware foreign keys
- append-only database triggers
- latest-active-consent gates for events, memory, snapshots, and interventions
- atomic intervention status and history writes
- optimistic concurrency for intervention status transitions
- focused route, service, repository, validation, migration, and boundary tests

## Deferred

- automated identity snapshot computation
- model-generated risk scoring
- recommendation generation
- learner mirror UI
- social graph analysis
- faculty and advisor work queues
- retention, deletion, export, and legal-hold operations
- production database RLS matrix verification

## Next Slice

Build the consent lifecycle and evidence ledger:

1. consent read/history and explicit revocation APIs
2. immutable consent audit events
3. learner-facing consent controls
4. database-backed RLS tests for learner, faculty, advisor, registrar, and
   institution administrator actors
5. retention and deletion policy artifact

Predictive computation remains blocked until this slice is merged and verified.
