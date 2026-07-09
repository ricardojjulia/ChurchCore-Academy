# Faculty Grade Entry Slice

Date: 2026-07-08

## Objective

Continue the Core Academic Loop by turning the ADR-0054 faculty assignment grade-entry page from a read-only placeholder into a working bulk grade-entry surface.

## Scope

- Keep the existing assignment-based gradebook model.
- Align grade-entry service reads and writes with the current section-registration schema:
  - `academy_course_section_registrations.course_section_id`
  - `academy_course_section_registrations.student_person_id`
  - `academy_gradebook_submissions.grade_points`
  - `academy_gradebook_submissions.pass_fail_result`
- Return the full registered/completed section roster for an assignment, including students without a saved grade yet.
- Add a client-side faculty grade-entry form that posts to:
  - `POST /api/academy/sections/[id]/assignments/[assignmentId]/grades`
- Refresh the page after save so the server-rendered grade state stays authoritative.

## Deferred

- Registrar transcript posting remains a later slice.
- Official transcript entries remain immutable snapshots in a later slice.
- Student/guardian grade visibility remains governed by existing PWA/guardian grade surfaces.

## Verification

- Red/green tests for current-schema grade-entry service queries.
- Source test proving the faculty assignment page uses an interactive grade-entry form and no longer carries the frontend-placeholder note.
- Full test, lint, build, migration-seed rehearsal, diff whitespace, and browser smoke.
