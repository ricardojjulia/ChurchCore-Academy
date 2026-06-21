# Course Registration And Enrollment Confirmation Design

Date: 2026-06-21
Governing ADR: ADR-0033 Full SIS Competitive MVP Release Program
Slice: 1

## Purpose

Convert the accepted-admission enrollment workflow into a real course-section registration workflow. This slice makes registration eligibility deterministic, persists section enrollment, exposes an admin review surface, and makes the Student PWA schedule reflect actual registrations instead of open catalog sections.

## Scope

In scope:

- Accepted and converted admission registers into a section through the existing enrollment-confirmation API.
- Eligibility checks run before registration insert:
  - accepted admission
  - converted student, program enrollment, and period registration
  - section and period registration academic-period match
  - section status
  - registration window
  - capacity
  - duplicate active registration
  - prerequisites where prerequisite records exist
  - hold blocker extension point
- Immutable enrollment-confirmation event vocabulary expands for future create, waitlist, confirm, withdraw, and override events.
- Admin Sections screen reviews actual registrations by section.
- Student PWA runtime schedule and courses read signed-in student registrations from Postgres.

Out of scope:

- Billing ledger creation.
- LMS provisioning.
- Full add/drop refund rules.
- Student self-service registration cart.
- Operational financial/academic holds table. The service now accepts hold blockers and the repository returns no active holds until that domain is introduced.

## Data Boundary

Registration remains tenant-scoped through `withAcademyDatabaseContext()` and RLS-enabled Academy tables.

Primary writes:

- `academy_course_section_registrations`
- `academy_enrollment_confirmation_events`

Primary reads:

- `academy_admission_applications`
- `academy_program_enrollments`
- `academy_period_registrations`
- `academy_course_sections`
- `academy_course_prerequisites`
- `academy_enrollment_windows`
- `academy_people`
- `academy_student_profiles`

## Runtime Behavior

1. Actor identity is resolved from the verified Academy session.
2. Service checks role access for admissions, registrar, academic admin, dean, or institution admin.
3. Idempotency replay returns existing registration for the same tenant/key.
4. Converted admission metadata is required.
5. Repository evaluates section eligibility using tenant-scoped SQL.
6. Service rejects blockers with `AcademyConflictError`.
7. Repository inserts the registration and confirmation event.
8. Admin and student read models surface the persisted registration.

## Acceptance Criteria

- Registration rejects full sections.
- Registration rejects duplicate active section registrations.
- Registration rejects closed registration windows.
- Registration rejects prerequisite and hold blockers.
- Migration discovery proves the workflow expansion migration follows the original registration migration.
- Admin Sections page displays registration rows inside the application.
- Student PWA schedule/courses are derived from `academy_course_section_registrations` in normal runtime.
- Focused tests, lint, and build pass.
