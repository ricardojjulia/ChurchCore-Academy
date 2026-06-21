# Course Registration And Enrollment Confirmation Execution Plan

Date: 2026-06-21
Program: ADR-0033 Full SIS Competitive MVP
Slice: 1

## Goal

Deliver one transactional SIS workflow: accepted application to confirmed course-section registration, with admin and student-visible outcomes.

## Tasks

1. Discovery
   - Inspect `src/modules/course-registration/*`.
   - Inspect `/api/academy/registrations` and admissions enrollment-confirmation routes.
   - Inspect course catalog, academic calendar, enrollment conversion, Student PWA, and admin section screens.

2. Red Tests
   - Add service tests for capacity, duplicate registration, registration window, prerequisites, and holds.
   - Add migration test coverage for expanded status and event vocabulary.

3. Domain Implementation
   - Add `CourseSectionRegistrationEligibility`.
   - Add repository eligibility evaluation.
   - Enforce eligibility in `CourseRegistrationService.registerAndConfirm()`.
   - Preserve idempotency replay and converted-admission requirements.

4. Persistence
   - Add append-only migration expanding registration statuses and audit event types.
   - Keep existing registration table and confirmation event table as the transactional boundary.

5. UI And Read Models
   - Replace raw API link on Admin Sections with in-app registration review rows.
   - Make Student PWA normal runtime load schedule/courses from persisted registrations.

6. Documentation
   - Add design spec.
   - Add runbook.
   - Update factory roadmap.

7. Verification
   - Focused course-registration and Student PWA tests.
   - Full `npm test`.
   - `npm run lint`.
   - `npm run build`.

## Review Notes

- This slice intentionally does not create billing, LMS, or financial-aid side effects.
- Hold handling is modeled in the service contract and tests; repository integration remains empty until the holds domain exists.
- Student PWA dataset fixture support remains for tests, but normal runtime now uses `requireActor()` and tenant-scoped DB reads.
