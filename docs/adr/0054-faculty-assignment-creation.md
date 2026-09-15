# ADR-0054 — Faculty Assignment Creation and Per-Assignment Grade Entry Model

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`

---

## Context

The gradebook module supports direct final-grade entry and posting. Faculty cannot create assignments,
track per-assignment grades, or compute a weighted section grade from individual assessments. This
means every grade must be manually calculated outside the system and entered as a final grade.

For institutions that want to track quiz, midterm, project, and final exam grades separately, the
current model is not usable. The competitive gap is significant: every major SIS (Populi, Sycamore,
PowerSchool) supports per-assignment grading.

The GPA engine (ADR-0043) computes GPA from posted grades. This ADR adds the assignment layer that
feeds into the existing grade-posting flow.

---

## Decision

### 1. Assignment entity

Add `academy_assignments` table:

- `id`, `tenant_id`, `section_id`
- `title`
- `description` (optional)
- `due_date`
- `max_points` — integer, required; sets the scale for the assignment
- `weight` — integer percentage (0–100); all assignment weights in a section must sum to ≤ 100;
  if weights sum to < 100, the remainder is treated as unweighted participation
- `grading_type`: `points` | `pass_fail` | `rubric`
- `created_by` — person_id of the faculty member
- `created_at`
- `locked` — boolean; true once any submission exists; prevents max_points and weight changes

Faculty may edit `title`, `description`, and `due_date` at any time. `max_points` and `weight` are
locked once the first submission is created.

### 2. Assignment submission / grade entry

Add `academy_assignment_submissions` table:

- `id`, `tenant_id`, `assignment_id`, `student_registration_id`
- `grade_points` — nullable decimal; null means not yet graded
- `pass_fail_result`: `pass` | `fail` | null
- `submitted_at` (when student submitted, if tracked)
- `graded_at`
- `graded_by` — person_id of faculty

Faculty enter grades per student per assignment at `/faculty/gradebook/[sectionId]/assignments/[assignmentId]`.
The UI shows a grid of enrolled students with a points-entry field alongside each name.

### 3. Weighted grade computation

When a faculty member clicks "Compute Section Grade" (not automatic), the service computes each
student's weighted section grade as:

```
weighted_grade = sum( assignment.grade_points / assignment.max_points * assignment.weight )
               / sum( assignment.weight for graded assignments )
```

The computed grade is converted to the section's grading scale (letter, pass/fail, competency, narrative)
and pre-filled into the existing grade-entry field. Faculty may accept or override the computed grade
before posting.

**The computation is advisory.** Faculty always post the final grade manually through the existing
grade-posting flow. No automatic grade post occurs.

### 4. GPA recalculation trigger (wildcard condition from Council Review X)

The existing GPA recalculation trigger fires when a grade is posted via the gradebook post endpoint.
This ADR adds no new trigger path. The faculty-posted grade goes through the same `postGrade` service
function that fires GPA recalculation. The assignment layer feeds the pre-fill suggestion; the post
action is unchanged.

### 5. API routes

- `POST /api/academy/sections/[id]/assignments` — create assignment (faculty/admin role)
- `PATCH /api/academy/sections/[id]/assignments/[assignmentId]` — edit assignment (validates lock)
- `GET /api/academy/sections/[id]/assignments` — list assignments for section
- `POST /api/academy/sections/[id]/assignments/[assignmentId]/grades` — bulk grade entry (array of `{studentRegistrationId, gradePoints}`)
- `GET /api/academy/sections/[id]/assignments/[assignmentId]/grades` — grade sheet
- `GET /api/academy/sections/[id]/computed-grades` — returns computed weighted grades for all students (advisory)

### 6. Faculty UI

- `/faculty/gradebook` — section list
- `/faculty/gradebook/[sectionId]` — assignment list + "Add Assignment" button
- `/faculty/gradebook/[sectionId]/assignments/[assignmentId]` — grade entry grid

---

## Consequences

- Faculty can track per-assignment grades and compute weighted section grades.
- The advisory computation model preserves faculty control over final grade posting.
- GPA recalculation continues to fire on grade post, unchanged.
- Weight validation prevents faculty from accidentally over-weighting assignments.

---

## Alternatives Considered

**Automatic grade post from assignment average:**
Rejected. Faculty judgment is required for final grades, especially in faith-based education where
participation, spiritual engagement, and pastoral context influence grades.

**Store grades as percentages, not points:**
Rejected. Points are more natural for faculty entry. Percentage conversion is done at display time.

---

## Security / Privacy Review Notes

- The grade entry route must verify the faculty member is the assigned instructor for the section
  (or has admin role) before accepting grade submissions.
- Computed grades must not be returned for students outside the actor's tenant.
- Grade data must not appear in error messages returned to the client.

---

## Related

- ADR-0043 — GPA calculation engine and grade-to-profile linkage
- ADR-0051 — Course catalog admin CRUD (sections reference periods)
- ADR-0044 — Transcript PDF generation (grade history feeds transcript)
