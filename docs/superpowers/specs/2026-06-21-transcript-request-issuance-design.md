# Transcript Request And Issuance Design

Date: 2026-06-21
Governing ADRs: ADR-0033 Full SIS Competitive MVP Release Program, ADR-0034 Transcript Request And Issuance Workflow
Slice: 3

## Purpose

Make transcripts a real SIS workflow: student request, registrar hold/release, registrar issuance, revoke, and export filtering. This replaces the prior issuance-only surface with a service-enforced, audited workflow.

## Scope

In scope:

- Student PWA transcript request action from `/student/documents`.
- Admin transcript issuance from `/admin/transcripts`.
- Verified actor authorization for student self-service and registrar administration.
- Idempotency for request and issue mutations.
- Transcript statuses: `requested`, `held`, `issued`, `released`, `revoked`.
- Immutable transcript event table.
- Hold/release/revoke route handlers.
- Issuance gate requiring posted and student-released transcript gradebook records.
- Export helper that excludes unreleased or non-posted grade records.
- Admin roster fix so transcript subject IDs use student person IDs, not student profile IDs.

Out of scope:

- Certified PDF rendering.
- Payment, balance, or institutional financial-hold integration.
- External transcript exchange delivery.
- Registrar queue dashboards beyond the current admin issuance page.
- Notification delivery for request/issue events.

## Actors And Roles

- Student: may request and list only their own transcript records.
- Registrar, academic admin, dean, institution admin: may issue, hold, release, revoke, and list transcript records for students in the active tenant.
- Faculty, guardian, applicant: no transcript administration access.

## Data Boundary

Primary writes:

- `academy_transcript_issuances`
- `academy_transcript_events`

Primary reads:

- `academy_gradebook_records`
- `academy_gradebook_assignments`
- `academy_courses`
- `academy_student_profiles`
- `academy_people`

All reads and writes run through `withAcademyDatabaseContext()` and include the actor tenant.

## Runtime Behavior

1. API resolves the actor from a verified Academy session or local bootstrap in allowed dev mode.
2. Mutation routes require an idempotency key.
3. Student request defaults the subject to the actor person ID when `action=request`.
4. Registrar issuance checks for posted, student-released gradebook records and active transcript holds.
5. Hold, release, and revoke transitions write immutable transcript events.
6. Student list reads reject other-student access and suppress revoked rows.
7. Export output includes only posted records with `releasedToStudentAt`.

## Acceptance Criteria

- Student self-service can create a `requested` transcript for the signed-in student.
- Student cannot request or read another student's transcript records.
- Registrar can issue only when posted, released transcript records exist and no active hold exists.
- Registrar can hold, release, and revoke through API state transitions.
- Faculty cannot administer transcripts.
- Admin transcript form posts an idempotent `issue` request with person IDs.
- Student documents page exposes a real transcript request action.
- Migration adds transcript event immutability and RLS.
- Focused transcript tests, route tests, TypeScript check, lint, migration replay, full tests, and build pass.
