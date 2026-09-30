# ADR 0075: OneRoster Delivery-State Reconciliation

Date: 2026-09-30
Status: accepted

## Context

Academy exports OneRoster 1.2 delta packages for a selected section. Registration withdrawals already produced deleted enrollments, but archived or cancelled sections and institution-level student departures disappeared from the current export. The LMS therefore retained stale records. Emitting every archived or inactive Academy record would be unsafe because OneRoster deletion semantics may target records that a destination never received.

## Decision

Academy will keep private delivery state keyed by tenant, destination, section scope, record type, and sourced ID for the mutable roster records it successfully issues: users, roles, classes, and enrollments.

Before a package is generated, Academy compares current roster state with the active records previously delivered to that exact destination and scope. It emits `tobedeleted` only for previously delivered records that are now deleted or absent. Current deletion candidates that have no matching delivery record are omitted. Parent organization, academic-session, and course rows remain current referential context and are not reconciled as deletions in this slice.

Manual downloads and signed scheduled delivery use separate destination keys. Manual state advances after the ZIP is built for issuance. Scheduled state advances only after the LMS confirms validation or duplicate receipt. Failed delivery does not advance state.

Exports remain delta-only. This decision does not authorize bulk omission reconciliation, LMS-side application, identity auto-linking, or changes to Academy's system-of-record ownership.

## Consequences

- Archived/cancelled classes, their enrollments, and departed users/roles can be removed from an LMS without deleting unknown records.
- Delivery state is tenant-isolated, destination-specific, and protected by forced RLS.
- Reconciliation is scoped to one selected section because that is the current delivery contract.
- A manual download records issuance, not proof that an operator imported the ZIP. Operators must preserve the existing review workflow.
- Expanding to multi-section or whole-tenant delivery requires an explicit scope model and migration rather than treating omission as deletion.

## Review Notes

- Product boundary: Academy remains the roster source; LMS review/apply behavior is unchanged.
- Security/privacy: stored payloads contain only the already-approved OneRoster subset and remain private under tenant RLS.
- Testing: cover archived sections, departed students, never-delivered suppression, destination/scope isolation, migration constraints, and failed-delivery state behavior.
- Rollback: disable reconciliation at the route boundary if needed; retain delivery state for audit and use a forward migration for schema changes.
