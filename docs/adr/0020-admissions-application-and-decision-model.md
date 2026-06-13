# ADR 0020: Admissions Application And Decision Model

Date: 2026-06-13
Status: accepted

## Context

ChurchCore Academy needs a production admissions workflow before an applicant becomes a student. Treating an application as an active student or enrollment record would grant academic identity too early, weaken auditability, and couple admissions decisions to registration.

## Decision

- An admission application is a pre-student record linked to an Academy person with the explicit `applicant` role.
- Applications move through deterministic states: `draft`, `submitted`, `under_review`, `accepted`, `declined`, or `withdrawn`.
- Applicants may create, read, and submit only their own same-tenant records.
- Admissions staff, registrars, deans, and institution administrators may review and decide same-tenant records.
- Every mutation requires an idempotency key and writes both an append-only application event and a redacted global audit event in the caller-owned transaction.
- Application, person, program, term, decision actor, and event references use composite tenant foreign keys.
- RLS is enabled and forced on applications and events.
- Acceptance does not create a student profile, enrollment, registration, invoice, LMS account, or financial-aid record.

## Consequences

- Duplicate mutation retries are deterministic and do not create duplicate events.
- Cross-tenant references are rejected by both relational constraints and RLS.
- Incorrect decisions are not edited in place; recovery requires an explicit future forward-event workflow.
- Release 2 Slice 2 must own accepted-application conversion into student and enrollment records.
