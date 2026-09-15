# Student Program Progress Slice

Date: 2026-07-08

## Objective

Continue the Core Academic Loop by replacing the legacy student progress placeholder with a read-only, catalog-year curriculum progress projection.

## Scope

- Resolve the student's active program membership and catalog academic year.
- Read active curriculum requirements for that program/year.
- Classify each requirement from section registration history:
  - `completed` when a matching section registration is completed.
  - `in_progress` when a matching section registration is active.
  - `not_started` when no matching attempt exists.
- Display final course-summary letter grades when available.
- Expose the projection through a request-scoped API route and the admin student detail page.

## Deferred

- Grade Entry remains its own write slice.
- Transcript Entries remain immutable snapshots in a later slice.
- Minimum-grade enforcement remains deferred until Grade Entry and transcript rules are authoritative.

## Verification

- Module tests for staff authorization and repository mapping.
- Route/page source tests for request-scoped database usage and UI wiring.
- Full test, lint, build, migration-seed rehearsal, and browser smoke after implementation.
