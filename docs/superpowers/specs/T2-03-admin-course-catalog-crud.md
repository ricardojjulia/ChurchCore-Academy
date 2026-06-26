# Story: Admin Course Catalog CRUD
**ID:** T2-03
**Tier:** 2 — Complete Core SIS Workflows
**Status:** Implemented in Sprint A / PR #61
**Date:** 2026-06-22

## User Story
As an academic registrar, I want to create, edit, and archive courses in the course catalog so I can maintain an accurate course inventory without needing a developer to insert database records.

## Background
The course catalog reads from a real `academy_courses` table, but the `/admin/courses` page is entirely read-only. There are no forms for creating or editing courses. Any new course requires a direct database insert, which is not viable for a real institution.

## Acceptance Criteria
1. The `/admin/courses` page has a "New Course" button that opens a form (modal or slide-out panel).
2. The form collects: course code (required, unique per tenant), title (required), description, credit hours (number), clock hours (number), course type (lecture, lab, seminar, online, practicum — from institution config), delivery mode, and prerequisites (multi-select from existing courses).
3. Saving creates the course with `status: draft` until activated.
4. An "Activate" action moves course from `draft` to `active` and makes it available for section creation.
5. Clicking an existing course opens an edit form with all fields pre-filled.
6. Draft and active courses can be fully edited. Only course code is locked after a section has been created against it.
7. "Archive" action moves course to `archived` status, removing it from the active catalog while preserving all historical section and grade records.
8. Archived courses cannot be activated or have new sections created against them.

## Edge Cases
- Duplicate course code within the same tenant: save is blocked with "Course code already exists in your catalog."
- Editing a course code when sections exist: field is disabled with tooltip "Course code cannot be changed after sections have been created."
- Archiving a course with active current-term sections: blocked with "This course has active sections in the current term. Remove sections before archiving."
- Prerequisites creating a cycle (Course A requires B, B requires A): validation error at save.
- Credit hours of 0 with clock hours > 0: allowed (valid for continuing education / practicum).

## Out of Scope
- Bulk course import from CSV (Tier 4)
- Cross-institution course sharing (Tier 4)
- Course approval workflow / committee review

## Role Matrix
| Role | Create | Edit Draft | Edit Active | Archive | View |
|------|:------:|:----------:|:-----------:|:-------:|:----:|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Registrar | ✓ | ✓ | ✓ | ✓ | ✓ |
| Faculty | ✗ | ✗ | ✗ | ✗ | ✓ |
| Student | ✗ | ✗ | ✗ | ✗ | ✓ (catalog) |

## Technical Notes
- Module: `src/modules/course-catalog/` — extend existing repository with `createCourse`, `updateCourse`, `archiveCourse`
- API routes: `POST /api/academy/courses`, `PATCH /api/academy/courses/[id]`, `DELETE /api/academy/courses/[id]` (soft delete → archive)
- Page: `src/app/admin/courses/page.tsx` — add New Course button; course rows need edit/archive actions
- Prerequisite validation must check for cycles server-side (DFS on the prerequisites graph)
- `status` column on `academy_courses` — check if it exists in migration; add if not

## Tests Required
- `createCourse()` success: course created with `status: draft`, unique code validated.
- `createCourse()` duplicate code rejection: same code on same tenant → validation error.
- `createCourse()` cross-tenant rejection: registrar on tenant A cannot create course attributed to tenant B.
- `updateCourse()` success: title, description, credits updated for draft course.
- `updateCourse()` code-lock enforcement: course with existing sections cannot change course code.
- `archiveCourse()` active sections block: course with current-term sections cannot be archived.
- `archiveCourse()` success: course without active sections archived; no longer returned by `listActiveCourses()`.
- Prerequisite cycle detection: circular prerequisite graph returns validation error.
