# ADR-0053 — Attendance Threshold Enforcement and Guardian Absence Notification

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`

---

## Context

The attendance module accepts faculty entry and displays aggregate views. No threshold enforcement
exists: students can miss sessions indefinitely with no system response. No guardian notifications
are sent when a student misses consecutive sessions. This gap means attendance data is collected
but not acted upon, which defeats the purpose for institutions that require minimum attendance for
credit or graduation.

Faith-based institutions often have pastoral as well as academic attendance obligations. A student
missing chapel services may require a pastoral check-in, not just an academic warning.

---

## Decision

### 1. Attendance threshold configuration

Each course section may define a `minimum_attendance_percentage` (integer, 0–100, default 80).
This is set by the faculty instructor or admin at section configuration time.

A section with `minimum_attendance_percentage = 0` has attendance tracking disabled (no alerts fire).

### 2. Threshold breach detection

After each attendance posting, the attendance service calls
`checkAttendanceThreshold(studentId, sectionId)`:

1. Compute `attended_sessions / total_sessions_held` as a percentage.
2. If the result is below `minimum_attendance_percentage` and the student has not already been alerted
   in the current term period, enqueue a ShepherdAI early-alert signal of type `attendance_threshold_breach`.
3. ShepherdAI processes the signal into a suggested workflow for the registrar queue.
4. The alert is not repeated until the student's attendance drops by an additional 10 percentage points
   (prevents alert spam).

This follows the ADR-0031 deterministic signal pattern. ShepherdAI recommends; humans act.

### 3. Guardian absence notifications

Guardian notifications fire independently of the ShepherdAI threshold signal. Rules:

- If a student under 18 misses **3 or more consecutive sessions** in a single section:
  - Enqueue a guardian notification email via the communications queue (ADR-0040).
  - Message includes: section name, dates missed, faculty contact name.
  - One notification per 3-consecutive-miss event; does not repeat until 3 more consecutive misses.

- If a student has a guardian linked and misses any **chapel** or **required spiritual formation**
  session type (section type tag `spiritual_formation`): notify the guardian on the first miss, then
  again on each subsequent miss, regardless of consecutive rule.

Guardian notification respects the guardian's `notification_preferences` column (opt-out per
notification type). Default is opt-in for absence alerts.

### 4. Session type tagging

Add `session_type` column to attendance session records: `class` | `lab` | `chapel` | `spiritual_formation` | `other`.

Faculty selects session type when creating attendance records. The default is `class`.

### 5. API changes

- `POST /api/academy/attendance` — existing route; add threshold check + guardian alert enqueueing
- `GET /api/academy/attendance/threshold-status?sectionId=&studentId=` — returns current percentage and whether below threshold
- `GET /api/academy/sections/[id]/attendance-config` — returns `minimum_attendance_percentage`
- `PATCH /api/academy/sections/[id]/attendance-config` — faculty/admin sets threshold

---

## Consequences

- Institutions can enforce minimum attendance with automated early alerts.
- Guardians of minor students receive absence notifications without manual registrar intervention.
- ShepherdAI handles threshold alerts as a deterministic signal, preserving the non-chatbot model.
- Alert deduplication prevents notification fatigue.

---

## Alternatives Considered

**Automatic grade penalty on threshold breach:**
Rejected. Academic consequences (grade deductions, course withdrawal) require human judgment.
ShepherdAI recommends a workflow; a faculty member or registrar acts.

**Hard block: prevent grade posting for students below threshold:**
Rejected. Faith-based institutions often grant pastoral exceptions. A hard block would require
developer intervention to release. A ShepherdAI recommended-workflow model keeps humans in control.

---

## Security / Privacy Review Notes

- Guardian notifications must not include the student's full grade record or other students' information.
- `spiritual_formation` session type is sensitive. Guardian notification for these sessions should
  use a generic subject line that does not expose session content.
- Notification opt-out preferences must be respected before any message is enqueued.

---

## Related

- ADR-0031 — Workflow evaluator invocation pattern (ShepherdAI signal model)
- ADR-0037 — Notification provider and retention boundary
- ADR-0040 — Email delivery provider and queue worker
- ADR-0049 — Student record editable fields (guardian relationship and `date_of_birth`)
