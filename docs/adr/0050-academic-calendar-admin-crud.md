# ADR-0050 — Academic Calendar Admin CRUD with Term-Lock Policy

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`

---

## Context

The academic calendar schema (terms, periods, sessions) exists in the database. A read-only review
view exists at `/admin/settings/calendar`. No admin can create, edit, or archive a term or period
through the UI. This blocks downstream workflows: sections cannot be assigned to periods that do not
exist, and enrollment windows cannot be configured.

The calendar is foundational. Every other PARTIAL item (course sections, enrollments, attendance,
grade posting) depends on an active term/period configuration.

---

## Decision

### 1. Editable lifecycle states

Terms and periods move through states: `planned` → `enrollment_open` → `active` → `completed` → `archived`.

- **`planned`**: fully editable (name, start/end dates, registration window, fee due dates)
- **`enrollment_open`**: start/end dates locked; registration window dates still editable
- **`active`**: all dates locked; description and display name still editable
- **`completed`** and **`archived`**: read-only; no edits permitted

The UI shows a lock indicator alongside each field to communicate why a field is not editable.

### 2. Section assignment lock

Once any section is assigned to a period (`academy_course_sections.period_id = this period`), that
period's start and end dates are locked regardless of state. The admin UI shows a warning:
"X sections are assigned to this period. Dates cannot be changed."

If the admin needs to correct dates, they must reassign all sections to a different period first.

### 3. API routes

- `POST /api/academy/calendar/terms` — create a term (admin role required)
- `PATCH /api/academy/calendar/terms/[id]` — edit a term (checks state-based lock)
- `POST /api/academy/calendar/terms/[id]/periods` — create a period within a term
- `PATCH /api/academy/calendar/terms/[id]/periods/[periodId]` — edit a period (checks state and section lock)
- `PATCH /api/academy/calendar/terms/[id]/status` — transition term state (validates transition direction)
- `PATCH /api/academy/calendar/terms/[id]/periods/[periodId]/status` — transition period state

All routes require `admin` or `registrar` role. Tenant isolation enforced on every operation.

### 4. Admin UI

- `/admin/settings/calendar` — list all terms with state badges and action buttons
- Term detail drawer: edit form with locked fields greyed out, period list with inline edit
- State transition buttons: "Open Enrollment", "Set Active", "Complete", "Archive"
- "New Term" button → modal with name, start date, end date, type (semester/quarter/trimester/module)
- Period list within each term: inline create, edit, state transition

### 5. Archive vs delete

Terms and periods are archived (`archived = true` + state = `archived`), never hard-deleted.
A term with active registrations or grade records cannot be archived — the route returns `409`
with a count of blocking records.

---

## Consequences

- Admins can fully configure the academic calendar without developer intervention.
- The lock policy prevents date changes on active terms, protecting grade and attendance records
  from retroactive calendar manipulation.
- Archive-not-delete preserves historical calendar data for compliance and transcript assembly.

---

## Alternatives Considered

**Allow free editing of all dates regardless of state:**
Rejected. Changing an active period's dates would invalidate attendance records, enrollment
windows, and grade post timestamps that reference those dates.

**Single "term" entity with no sub-periods:**
Rejected. Faith-based institutions structure terms differently: a semester may contain a midterm
exam period, a spring break, and a finals period. The period model is necessary.

---

## Security / Privacy Review Notes

- State transition routes must validate the transition direction server-side (cannot go from `completed`
  back to `active`).
- Section-assignment lock must be enforced at the service layer, not only in the UI.

---

## Related

- ADR-0002 — Institution type and operating rules model (institution-type-specific term names)
- ADR-0051 — Course catalog and section admin CRUD (sections reference periods)
