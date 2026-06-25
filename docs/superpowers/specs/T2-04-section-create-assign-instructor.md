# Story: Section Create and Instructor Assignment
**ID:** T2-04
**Tier:** 2 — Complete Core SIS Workflows
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story
As an academic registrar, I want to create course sections and assign instructors so that the schedule is accurate, faculty can access their rosters, and students can register for specific sections.

## Background
`academy_course_sections` exists with real data readable on `/admin/sections`, but there are no creation or editing forms. Instructor assignment requires a direct database update. Faculty see sections in their portal via foreign key but cannot be assigned through any UI action.

## Acceptance Criteria
1. `/admin/sections` has a "New Section" button that opens a creation form.
2. Form fields: course (dropdown from active catalog), term (dropdown from active calendar terms), section code (e.g., "A", "01"), meeting pattern (days + time), room/location, capacity, delivery mode, and instructor (dropdown from active staff members).
3. Section is created and immediately visible on the Sections & Schedule page and in the assigned instructor's faculty portal.
4. Clicking an existing section opens an edit form with all fields editable while no students are enrolled.
5. After enrollment begins, capacity and meeting pattern remain editable; course and term are locked.
6. "Remove Instructor" action clears the instructor assignment (section becomes unassigned).
7. "Reassign Instructor" allows selecting a different staff member.
8. Section capacity enforced on student registration: new registrations blocked when `current_enrollment >= capacity`.

## Edge Cases
- Assigning a staff member who is not in the staff directory: dropdown only shows active staff — prevented at UI level and validated server-side.
- Creating two sections with the same course + term + section code: blocked ("Section code must be unique within a course-term combination").
- Setting capacity below current enrollment count: blocked ("Cannot reduce capacity below current enrollment of N students").
- Instructor assigned to 10+ sections simultaneously: allowed but triggers a ShepherdAI `faculty_or_course_assignment_imbalance_review` suggestion.
- Deleting a section with enrolled students: blocked; must unenroll students first.

## Out of Scope
- Automated conflict detection for room scheduling (Tier 4)
- Waitlist management beyond capacity enforcement (Tier 3/T3-06)
- Cross-section combined enrollment

## Role Matrix
| Role | Create | Edit | Assign Instructor | Delete | View |
|------|:------:|:----:|:-----------------:|:------:|:----:|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Registrar | ✓ | ✓ | ✓ | ✓ | ✓ |
| Faculty | ✗ | ✗ | ✗ | ✗ | Own sections |
| Student | ✗ | ✗ | ✗ | ✗ | Available sections |

## Technical Notes
- Module: `src/modules/course-catalog/` — add `createSection`, `updateSection`, `assignInstructor`, `deleteSection`
- API routes: `POST /api/academy/sections`, `PATCH /api/academy/sections/[id]`, `DELETE /api/academy/sections/[id]`
- Instructor dropdown: query `academy_staff_profiles` for `status: active` staff members
- ShepherdAI signal: `faculty_or_course_assignment_imbalance_review` already exists — trigger when instructor section count crosses threshold
- Page: `src/app/admin/sections/page.tsx` — add New Section button and row-level edit/assign actions
- Check migration for `instructor_id` foreign key on `academy_course_sections`

## Tests Required
- `createSection()` success: section created, instructor assigned, visible in faculty portal.
- `createSection()` duplicate code rejection: same course + term + code → validation error.
- `createSection()` cross-tenant rejection: registrar on tenant A cannot create section on tenant B.
- `assignInstructor()` success: instructor updated, previous instructor loses access.
- `updateSection()` capacity below enrollment: blocked with validation error.
- `deleteSection()` with enrollments: blocked.
- `deleteSection()` empty section: success.
