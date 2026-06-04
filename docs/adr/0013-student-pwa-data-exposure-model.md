# ADR 0013: Student PWA Data Exposure Model

Date: 2026-06-03
Status: accepted

## Context

The Student PWA will expose schedules, courses, progress, documents, messages, academic records, standing, graduation readiness, and LMS launch actions. These records may involve minors and guardians. They may also include data from domains with different release rules: courses, calendars, people, guardian relationships, grades, official records, transcript holds, and future LMS launch state.

If PWA pages read raw domain tables, they can accidentally expose draft grades, unreleased official records, setup warnings, private staff context, provider secrets, or another student's data.

## Decision

ChurchCore Academy Student PWA pages will read from student-scoped PWA read models.

Every PWA read must resolve:

- tenant
- actor person
- target student profile
- access mode: student self-access, guardian relationship access, or audited staff preview
- allowed data categories
- release and hold status for academic records

Student actors can read only their own PWA-visible records. Guardian actors can read only categories allowed by an active relationship to a specific student. Staff preview must be separate from student self-access and must be auditable.

PWA read models must return display-ready data after filtering. UI components must not make authorization decisions from raw records.

## Consequences

This makes student data exposure testable and reviewable before the UI grows.

It supports children's school guardian rules, adult student self-service, mixed institutions, and future LMS launch without weakening tenant isolation.

The tradeoff is extra read-model work before rich student pages can be built.

## Alternatives Considered

Read raw domain records in PWA routes:

- rejected because it spreads privacy decisions into UI code and increases leakage risk

Use role-only checks:

- rejected because guardian access must depend on active relationship scope, not tenant-wide guardian role

Let LMS decide student visibility:

- rejected because Academy owns SIS records, official records, transcripts, guardian release, and no-LMS mode

Student-scoped read models:

- accepted because they centralize filtering, support deterministic tests, and preserve the Academy/LMS boundary

## Review Notes

- Product boundary: Academy owns student-visible SIS records and release decisions.
- Security/privacy: implementation must test cross-tenant denial, self-scope, guardian relationship scope, release-state filtering, transcript hold filtering, and provider-secret exclusion.
- Testing: every PWA read model must have denial and visibility tests before UI pages consume it.
- Rollback: this sprint changes docs only; future read-model work should remain additive and tenant scoped.
