# ADR-0052 — Student Self-Registration Add/Drop and Enrollment Window Policy

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`

---

## Context

Students cannot register themselves for courses. Enrollment is entirely staff-driven. This makes
self-service scheduling impossible for institutions with large student bodies and prevents the student
PWA from offering add/drop functionality.

Faith-based institutions, including Bible schools and seminaries, typically allow students to self-select
elective courses. Mandatory core courses can still be pre-assigned by registrars; this ADR governs
student-initiated add and drop.

---

## Decision

### 1. Enrollment window dates

Each term period carries four key dates:

- `registration_open_at` — add/drop window opens
- `registration_close_at` — add/drop window closes; no new adds after this date
- `last_drop_date` — drops after this date result in a Withdrawal (W) grade, not a clean drop
- `withdrawal_date` — drops after this date require a registrar override (no-penalty withdrawal not available)

These dates are configured by admins when editing a period (ADR-0050). If not set, self-registration
is disabled for that period.

### 2. Add flow

When a student adds a section:

1. Verify current timestamp is within `[registration_open_at, registration_close_at]`.
2. Verify the section is in `enrollment_open` or `active` state.
3. Verify `section.registered_count < section.max_capacity`.
4. Call `checkPrerequisites(studentId, courseId)` (ADR-0051).
5. Check for schedule conflicts: no two registered sections may share an overlapping meeting time.
6. Create a `registration` record with status `enrolled`.
7. Decrement section capacity atomically (Postgres row-level lock on section row).
8. Emit audit event.

If any check fails, return a `422` with a safe message specific to the failure reason.

### 3. Drop flow

When a student drops a section:

- If current timestamp ≤ `last_drop_date`: delete the registration record (clean drop, no grade).
- If `last_drop_date` < current timestamp ≤ `withdrawal_date`: update registration status to `withdrawn`,
  post a `W` grade to the gradebook (does not affect GPA calculation per ADR-0043).
- If current timestamp > `withdrawal_date`: return `403 Forbidden` with message "Withdrawal deadline
  has passed. Contact the registrar." Registrar may force-drop via the admin route.

### 4. Minor student guardian approval

If the student's `date_of_birth` makes them under 18 at the time of registration:

- Registration is created in status `pending_guardian_approval`.
- A notification is enqueued to the guardian (via communications queue, ADR-0040) with a one-time
  approval link.
- Registrar can approve on behalf of the guardian if the guardian is unreachable (with a required note).
- If no approval is received within 7 days, the registration expires and the student is notified.

### 5. API routes

- `POST /api/academy/registrations` — student self-add (actor must be the student)
- `DELETE /api/academy/registrations/[id]` — student self-drop (actor must be the student)
- `POST /api/academy/registrations/[id]/approve-guardian` — guardian approval via token
- `POST /api/academy/admin/registrations` — registrar force-enroll (bypasses window and prerequisite checks with note)

### 6. Admin UI

Registrars see a student's current registrations and can add/remove regardless of window dates,
with a required override reason logged to the audit trail.

---

## Consequences

- Students can self-service their schedule during the registration window.
- Clean drop and withdrawal-with-W are distinct outcomes with correct GPA impact.
- Minor students are protected by a guardian approval gate.
- Capacity is atomically decremented, preventing over-enrollment.

---

## Alternatives Considered

**Allow free add/drop at any time:**
Rejected. Academic integrity requires enrollment windows. Unrestricted add/drop after grading begins
would allow students to retroactively enroll in courses they attended informally.

**Waitlist support:**
Deferred. Waitlists are a future feature. This ADR implements the direct-enroll path. When capacity
is full, the student sees a "Section full" message and is not added to a waitlist.

---

## Security / Privacy Review Notes

- Section capacity decrement must use a Postgres transaction with row-level locking, not application-level
  read-modify-write, to prevent over-enrollment under concurrent requests.
- Guardian approval tokens are single-use and expire in 7 days.
- The registrar force-enroll path must log the override reason to the audit trail.

---

## Related

- ADR-0050 — Academic calendar admin CRUD (period dates)
- ADR-0051 — Course catalog admin CRUD (prerequisite enforcement, section capacity)
- ADR-0043 — GPA calculation engine (W grade does not affect GPA)
- ADR-0055 — Student PWA full self-service (exposes this flow in the PWA)
