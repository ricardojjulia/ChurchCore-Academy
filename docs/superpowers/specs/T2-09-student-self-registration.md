# Story: Student Self-Registration (Add/Drop)
**ID:** T2-09
**Tier:** 2 — Complete Core SIS Workflows
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story
As a student, I want to browse available sections for the current term and add or drop courses from my schedule during the enrollment window so I can manage my own academic program without calling the registrar for every change.

## Background
`CourseRegistrationService` and the `academy_course_registrations` table exist with eligibility checking and idempotency. The student PWA schedule page shows registrations as read-only. The only way a student gets registered today is via the admissions enrollment-conversion action. There is no student-initiated registration or drop workflow.

## Acceptance Criteria
1. Student PWA shows an "Open Registration" banner during the enrollment window (between `enrollment_open_at` and `enrollment_close_at` on the current term).
2. Student can browse available sections for the current term: course name, instructor, meeting pattern, delivery mode, remaining seats.
3. Student clicks "Add" to register for a section. Server validates: within enrollment window, section has capacity, student meets prerequisites, student not already registered.
4. Confirmation message shown; section appears in the student's schedule immediately.
5. Student can drop a section with a "Drop" button. Drop is only allowed within the enrollment window.
6. After the enrollment window closes: add and drop buttons are hidden; schedule is read-only.
7. Registrar can add or drop on behalf of a student at any time (not window-restricted for admin users).

## Edge Cases
- Capacity full: "This section is full. No seats are available." (No waitlist in v1.)
- Student already registered for same section: idempotent — second add returns the existing registration, no error.
- Prerequisite not met: registration blocked with "You have not completed the prerequisite: [Course Name]."
- Dropping the last course: warning dialog "Dropping this course will leave you with no registered courses this term. This may affect your enrollment status. Continue?" — allowed, but ShepherdAI generates a signal.
- Registration outside window for admin/registrar: always allowed; student gets a "late registration" flag on the record.
- Section deleted after student registers: student's registration remains; section shows as "cancelled" in their schedule.

## Out of Scope
- Waitlist management (Tier 3/T3-06)
- Prerequisite override / waiver (Tier 3)
- Cross-term registration (registering in advance for future terms)

## Role Matrix
| Role | Self-Register | Drop Own | Register/Drop Any Student | View Schedule |
|------|:------------:|:--------:|:------------------------:|:-------------:|
| Student | Own / within window | Own / within window | ✗ | Own |
| Registrar | ✗ | ✗ | ✓ / any time | All |
| Admin | ✗ | ✗ | ✓ / any time | All |
| Faculty | ✗ | ✗ | ✗ | Own section roster |

## Technical Notes
- Existing service: `CourseRegistrationService` in `src/modules/course-catalog/` or `src/modules/` — verify exact path
- Enrollment window check: read `enrollment_open_at` / `enrollment_close_at` from current term (T2-05)
- PWA page: `src/app/student/courses/page.tsx` — add section browser + add/drop actions
- Section browse query: active sections for current term where `enrollment_status = 'open'`
- Capacity check: `current_enrollment < capacity` — use DB-level check to prevent races
- Prerequisite check: DFS through `academy_course_prerequisites` against student's `academy_gradebook_records` with `status: official`

## Tests Required
- `registerStudentForSection()` success: registration created, enrollment count incremented.
- `registerStudentForSection()` idempotency: second call returns existing registration.
- `registerStudentForSection()` at capacity: blocked with validation error.
- `registerStudentForSection()` prerequisite not met: blocked.
- `registerStudentForSection()` outside enrollment window (student): blocked.
- `registerStudentForSection()` outside enrollment window (registrar): allowed.
- `dropStudentFromSection()` success: registration removed, enrollment count decremented.
- `dropStudentFromSection()` outside window (student): blocked.
- Cross-tenant rejection: student cannot register for a section on a different tenant.
