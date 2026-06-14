# ADR 0022: Living Learner Intelligence Trust Boundary

- Status: Accepted
- Date: 2026-06-14
- Owners: Product Council, Architecture, Security, Academic Operations

## Context

The Living Learner Intelligence System (LLIS) stores behavioral events,
consent choices, durable learner memory, identity snapshots, energy check-ins,
and intervention recommendations. These records can affect academic support
decisions and may contain sensitive pastoral or confidential context.

The first implementation draft relied on request headers and JWT metadata for
tenant and role decisions. It also allowed staff to grant learner consent and
opened repository-managed transactions inside request-managed transactions.
Those patterns conflict with ADR 0017 and ADR 0018.

## Decision

LLIS uses the same verified Academy identity and database boundary as the rest
of the production API:

1. API routes resolve the actor through the verified Supabase session and
   Academy account-link and active-role records.
2. Every repository operation runs inside `withAcademyDatabaseContext`, which
   sets the tenant and person transaction settings consumed by RLS.
3. RLS policies use the `academy_private` identity functions. User-editable
   JWT metadata is never an authorization source.
4. Consent is learner-owned. Staff may read consent when their operational role
   requires it, but cannot grant or change consent for a learner.
5. Activity events, learner memory, identity snapshots, and intervention
   history are append-only at the database layer.
6. Predictive snapshots and intervention creation require the learner's latest
   active predictive-modeling consent. Event and memory writes require their
   corresponding latest active consent.
7. Tenant ownership is enforced with composite foreign keys for people,
   courses, snapshots, interventions, and audit-history relationships.
8. Sensitive memory is least-privilege: standard memory is available to
   authorized academic staff; pastoral and confidential memory is limited to
   institution administrators, deans, and advisors.
9. Repository methods participate in the request-owned transaction and do not
   begin or commit independent transactions.

## Consequences

- LLIS cannot operate from spoofed `x-academy-*` headers in production.
- Revoked or superseded consent prevents subsequent protected writes.
- Cross-tenant references fail even if application validation is bypassed.
- Intervention status changes and their history records commit atomically.
- Direct SQL maintenance of append-only records requires an explicit,
  privileged operational procedure rather than normal application writes.

## Follow-up

- Implement the scheduled retention job, deletion receipts, and governed export
  workflow defined in `docs/policies/llis-data-retention-and-deletion.md`.
- Add the first deterministic snapshot computation before introducing model
  generated predictions.
