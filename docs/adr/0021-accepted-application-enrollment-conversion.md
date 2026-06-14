# ADR 0021: Accepted Application Enrollment Conversion

Date: 2026-06-13
Status: accepted

## Context

An accepted applicant must become an active student without duplicating identity, creating partial records, or coupling admissions to billing, course sections, or LMS provisioning. The conversion must be retryable and tenant-safe because it creates several authoritative SIS records at once.

## Decision

- Only `institution_admin`, `registrar`, and `admissions` roles may convert same-tenant accepted applications.
- The application must be accepted and reference an academic period.
- One request-owned PostgreSQL transaction creates or activates the student role, allocates a tenant-scoped `S-000001` student number, creates the student profile, program enrollment, period registration, immutable conversion event, and redacted global audit event.
- The applicant role remains active. Conversion adds the student role rather than replacing applicant history.
- The application remains accepted and receives immutable references to the created records.
- Every request requires an idempotency key. Same-key retries return the original result; another key for the converted application returns a conflict.
- Tenant-aware composite foreign keys, forced RLS, explicit grants, restricted audit visibility, and immutable-event triggers enforce the boundary in PostgreSQL.
- Conversion does not register course sections, create billing or aid records, provision an LMS account, or release Student PWA records.

## Consequences

- Failed conversions roll back without partial student or enrollment records.
- Concurrent retries cannot allocate duplicate student identities or convert one application twice.
- Students can read only their own program enrollment and period registration.
- Deans may review admissions decisions but cannot activate student identity.
- Downstream registration, billing, financial aid, LMS, and record-release workflows remain separate reviewable slices.

## Alternatives Considered

- Convert automatically on acceptance: rejected because admissions decisions and student activation require separate authorization and recovery boundaries.
- Create records in separate requests: rejected because partial conversion would be operationally unsafe.
- Reuse the legacy `academy_students` projection: rejected because the normalized person, role, profile, program enrollment, and period registration records are the authoritative SIS model.

## Review Notes

- Product boundary: admissions-to-student activation only.
- Security/privacy: verified session, tenant context, role policy, RLS, immutable events, redacted audit.
- Testing: domain, repository, API, migration, clean reset, and live role matrix.
- Rollback: request failures roll back; shipped schema changes require a reviewed forward migration.
