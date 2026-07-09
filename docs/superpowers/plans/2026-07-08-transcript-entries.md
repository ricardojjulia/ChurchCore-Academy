# Transcript Entries Slice

Date: 2026-07-08

## Objective

Complete the next Core Academic Loop step by creating immutable, registrar-posted course-result snapshots for official transcript use.

## Source Requirements

A transcript entry can be created only when:

- the student has a completed course-section registration;
- the registration belongs to a canonical program membership with catalog year;
- the course is transcript-bearing;
- a final course summary exists;
- at least one grade record for the section has been posted by academic administration.

## Implementation

- Add `academy_transcript_entries` with copied course, period, program, credit, grade, GPA, and passing facts.
- Enforce one entry per course-section registration.
- Reject all update/delete operations through a database trigger.
- Add immutable `academy_transcript_entry_events`.
- Add a tenant-scoped registrar service and API route.
- Show existing entries and eligible completed courses on the admin student Academic Record tab.
- Make transcript issuance eligibility and PDF grade rows read transcript entries rather than mutable gradebook joins.

## Deferred

- Corrections require a future explicit superseding/amendment workflow.
- Cohorts and student groups remain the next Core Academic Loop slice.

## Verification

- Focused migration, authorization, repository, route, UI, and transcript-consumer tests.
- Full test, lint, build, migration-seed rehearsal, diff check, and browser smoke.
