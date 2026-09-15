# Story: GPA Calculation Engine
**ID:** T2-06
**Tier:** 2 — Complete Core SIS Workflows
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story
As a registrar, I want GPA to be automatically computed and updated whenever a grade is officially posted so that student profiles, academic standing, honor rolls, and ShepherdAI signals always reflect current accurate grade data — without manual data entry.

## Background
Grades are posted to `academy_gradebook_records` but no engine computes GPA from these records. The `gpa` field on `academy_student_profiles` exists but is a free-editable field that is never automatically populated. Student profiles show stale or null GPA values. ShepherdAI's academic standing signal depends on this field.

## Acceptance Criteria
1. A `computeStudentGpa(tenantId, studentId, client)` function exists in the grading module.
2. It reads all `academy_gradebook_records` with `status: 'official'` for the student.
3. Applies the institution's configured grading scale from `academy_grading_scales` to convert letter/percentage grades to quality points (A=4.0, B=3.0, etc.).
4. Computes weighted GPA: sum(quality_points × credit_hours) / sum(credit_hours), to 2 decimal places.
5. Pass/Fail courses: included in credits_earned count but excluded from GPA calculation.
6. Narrative/competency-only institutions: GPA field is null; function returns null without error.
7. The registrar's grade-posting action calls `computeStudentGpa()` immediately after posting and writes the result to `academy_student_profiles.gpa` in the same database transaction.
8. Cumulative GPA visible on: admin student profile page, student index, PWA progress page.
9. The ShepherdAI GPA-drop signal (T1-04) reads from this computed field.

## Edge Cases
- Student with no official grades: returns null (not 0.0) — null means "not yet graded", not "failed everything."
- All courses are Pass/Fail: credits_earned computed, GPA returns null (no quality-point courses).
- Repeated course: institution-configurable setting — either replace (only most recent grade counts) or average (all attempts averaged).
- Incomplete grade (`I`): excluded from GPA calculation until resolved to a final grade.
- Grade correction: re-posting corrected grade recalculates GPA atomically in same transaction.
- Credit hours of 0 (zero-credit seminar): excluded from GPA denominator but included in transcript record.

## Out of Scope
- Major/concentration GPA vs. cumulative GPA split (Tier 4)
- Transfer credit GPA inclusion (Tier 4)
- Honors/flagging on individual grades

## Role Matrix
| Role | Trigger Computation | View GPA | Override GPA |
|------|:-------------------:|:--------:|:------------:|
| Registrar | ✓ (via posting) | ✓ | ✗ (computed only) |
| Admin | ✓ (via posting) | ✓ | ✗ |
| Faculty | ✗ | Section roster only | ✗ |
| Student | ✗ | Own GPA | ✗ |

## Technical Notes
- Function location: `src/modules/grading/gpa-calculator.ts`
- Called from: `src/app/api/academy/gradebook/post/route.ts` (or wherever grade posting is handled)
- Grading scale lookup: `academy_grading_scales` table — join on `tenant_id` and `scale_id` from course
- Transaction requirement: GPA update and grade posting must be atomic — use same `client` instance
- ADR reference: ADR-0043 governs this feature
- `repeated_course_policy` setting: read from `academy_institution_configs` or equivalent config table

## Tests Required
- `computeStudentGpa()` success: 3 courses (A, B, C) with credit hours 3, 3, 3 → GPA = 3.0.
- `computeStudentGpa()` weighted: A in 4-credit course + C in 1-credit course → GPA = (4×4 + 2×1) / 5 = 3.6.
- `computeStudentGpa()` no official grades: returns null.
- `computeStudentGpa()` all pass/fail: returns null GPA, credits_earned > 0.
- `computeStudentGpa()` incomplete grade excluded: `I` grade not counted; recalculated when finalized.
- `computeStudentGpa()` cross-tenant rejection: cannot compute GPA using another tenant's grading scale.
- Grade-post transaction atomicity: if GPA write fails, grade post is also rolled back.
- GPA field is never a free-editable write target: verify `updateStudentProfile()` with `gpa` field is blocked.
