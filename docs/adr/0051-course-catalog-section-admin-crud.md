# ADR-0051 — Course Catalog and Section Admin CRUD with Archive Policy

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`

---

## Context

The course catalog module has read surfaces. No admin UI exists for creating, editing, or archiving
courses or sections. Course sections (the schedulable instances of a course in a period) also have no
admin CRUD. Without course and section management, institutions cannot configure what students can
register for, which blocks self-registration (ADR-0052) and the student PWA (ADR-0055).

---

## Decision

### 1. Course CRUD

Courses are the catalog-level definition of a subject. Courses belong to a department and carry
credit/clock-hour configuration, grading type, and prerequisites.

Editable fields on a course:
- `title`, `code`, `description`
- `credit_hours` and/or `clock_hours`
- `grading_type`: `letter` | `pass_fail` | `competency` | `narrative`
- `department_id`
- `prerequisite_course_ids` (array — circular prerequisites are rejected at the service layer)

A course may be **archived** if and only if it has no active sections (sections in state `scheduled`,
`enrollment_open`, or `active`). Archiving sets `archived = true`. Archived courses do not appear in
the section-creation dropdown or self-registration catalog. Historical registrations referencing an
archived course are unaffected.

### 2. Section CRUD

A course section is a scheduled offering of a course in a specific period with a specific instructor
and capacity.

Fields on a section:
- `course_id` (immutable after creation)
- `period_id` (immutable after creation)
- `instructor_person_id` — reassignable while section is in `scheduled` state; locked once `enrollment_open`
- `room` (optional)
- `max_capacity`
- `sync_policy`: `manual` | `automatic` (for LMS sync)
- `lms_provider_course_id` (set by LMS sync workers)

Section lifecycle states: `draft` → `scheduled` → `enrollment_open` → `active` → `completed` → `archived`.

Once any student is registered in a section, `course_id` and `period_id` are locked.
The instructor may be reassigned up to the section's `enrollment_open` transition.

### 3. API routes

- `POST /api/academy/courses` — create course (admin role)
- `PATCH /api/academy/courses/[id]` — edit course
- `PATCH /api/academy/courses/[id]/archive` — archive (validates no active sections)
- `POST /api/academy/courses/[id]/sections` — create section (admin/registrar role)
- `PATCH /api/academy/courses/[id]/sections/[sectionId]` — edit section (enforces state locks)
- `PATCH /api/academy/courses/[id]/sections/[sectionId]/status` — state transition
- `GET /api/academy/courses` — paginated catalog (filters: department, term, archived)
- `GET /api/academy/courses/[id]/sections` — sections for a course

### 4. Prerequisite enforcement

When a student attempts self-registration, the enrollment service calls
`checkPrerequisites(studentId, courseId)`. This checks whether the student has a completed
(grade posted and transcript-released) registration in each prerequisite course. If any prerequisite
is missing, self-registration is rejected with a safe message listing the missing courses.

Prerequisite override is available to registrars via the enrollment service's `forceEnroll` path.

### 5. Admin UI

- `/admin/courses` — course list with filters (department, archived toggle); "New Course" button
- Course detail page: edit form, section list, archive button
- Section modal: create/edit with period picker, instructor picker, capacity input
- Section state badge with transition button

---

## Consequences

- Admins have full control over the course catalog without developer intervention.
- Prerequisite enforcement protects course sequencing integrity.
- Archive-not-delete preserves historical catalog records for transcript assembly.

---

## Alternatives Considered

**Allow course deletion:**
Rejected. Courses referenced by historical registrations and transcripts cannot be deleted without
orphaning official records.

**Merge course and section into one entity:**
Rejected. The same course runs in multiple periods and sections. Conflating the two would force
duplication of course metadata (title, credits, grading type) across every section.

---

## Security / Privacy Review Notes

- Prerequisite check must run at the service layer. The UI check is UX only.
- Archive route must verify no active sections exist at the service layer.
- Instructor assignment is personally identifying data — route must enforce tenant isolation.

---

## Related

- ADR-0050 — Academic calendar admin CRUD (sections reference periods)
- ADR-0052 — Student self-registration (uses prerequisite enforcement)
- ADR-0054 — Faculty assignment creation (assignments reference sections)
