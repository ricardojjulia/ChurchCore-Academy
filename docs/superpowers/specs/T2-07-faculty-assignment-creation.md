# Story: Faculty Assignment Creation and Grade-per-Assignment Entry
**ID:** T2-07
**Tier:** 2 — Complete Core SIS Workflows
**Status:** Implemented in Sprint A / PR #61
**Date:** 2026-06-22

## User Story
As a faculty member, I want to create assignments for my sections and enter a score per student per assignment so I can build up a grade record throughout the term and submit a well-supported final grade for registrar review.

## Background
The faculty gradebook page (`/faculty/gradebook`) allows grade entry but only at the final grade level — there is no assignment structure. Faculty cannot create exams, papers, or participation grades. The grading module has a `academy_gradebook_assignments` table in the migration but no UI or API routes for creating or managing assignments.

## Acceptance Criteria
1. Faculty sees a "New Assignment" button on the gradebook page for each section they teach.
2. Assignment creation form: name, category (exam, quiz, paper, participation, lab, project), points possible, due date, weight percentage.
3. Weights across all assignments in a section must not exceed 100%; system warns but does not block (some faculty use extra credit).
4. Once assignments exist, faculty see a grid view: rows = students, columns = assignments.
5. Faculty can enter a numeric score (0 to points_possible) per student per assignment cell.
6. The weighted average auto-calculates as a draft final grade percentage shown per student.
7. Faculty can convert the draft percentage to a letter grade using the institution's grading scale.
8. "Submit for Review" action sends the draft final grade to the registrar posting queue (existing flow).
9. Faculty can edit scores until the term's grade submission deadline.

## Edge Cases
- Score entered higher than points possible: warning shown, allowed (extra credit).
- Student added to section mid-term after assignments were created: student added to grid with blank scores (null, not zero).
- Changing assignment weight after scores are entered: draft final grade immediately recalculates.
- Deleting an assignment: all associated scores are also deleted; draft final grades recalculate. Confirmation required.
- Grade submission deadline passed: score entry is locked; faculty see "Grade submission period has ended."
- Faculty teaching multiple sections of the same course: assignments are per-section, not shared.

## Out of Scope
- Rubric-based grading (Tier 4)
- Assignment submission / file upload by students (not an LMS feature of Academy)
- Plagiarism detection
- Grade distribution analytics

## Role Matrix
| Role | Create Assignments | Enter Scores | Submit Final | View Roster Grades |
|------|:-----------------:|:------------:|:------------:|:-----------------:|
| Faculty (own section) | ✓ | ✓ | ✓ | ✓ |
| Faculty (other section) | ✗ | ✗ | ✗ | ✗ |
| Registrar | ✗ | ✗ | ✗ | ✓ (all) |
| Admin | ✗ | ✗ | ✗ | ✓ (all) |
| Student | ✗ | ✗ | ✗ | Own grades only |

## Technical Notes
- Tables: `academy_gradebook_assignments` and `academy_gradebook_records` — check existing migration for schema
- Module: `src/modules/grading/` — add `createAssignment`, `updateAssignmentScore`, `deleteAssignment`
- API routes: `POST /api/academy/gradebook/assignments`, `PUT /api/academy/gradebook/assignments/[id]/scores`
- Faculty portal page: `src/app/faculty/gradebook/page.tsx` — extend with assignment grid
- Draft final grade calculation must be client-side for responsiveness but also validated server-side on submit
- `grade_submission_deadline` from the term record (T2-05) gates score entry

## Tests Required
- `createAssignment()` success: assignment created for faculty's own section.
- `createAssignment()` cross-section rejection: faculty cannot create assignment for a section they don't teach.
- `createAssignment()` cross-tenant rejection: faculty on tenant A cannot affect tenant B section.
- `updateAssignmentScore()` success: score saved; draft GPA recalculated.
- `updateAssignmentScore()` deadline passed: rejected with "Grade submission period has ended."
- `deleteAssignment()` success: assignment and all scores deleted.
- `submitDraftFinalGrade()` success: draft grade enters registrar posting queue.
- Weight warning: total weights > 100% triggers warning, does not block save.
