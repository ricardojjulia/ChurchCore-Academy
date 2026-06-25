# ADR-0056 — Guardian PWA Shell Auth Boundary and Scoped Portal Policy

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`

---

## Context

The guardian module has a FERPA-restricted scoped access layer and read surfaces for attendance
and grade summaries. No guardian-facing UI shell exists. Guardians cannot log in and view anything
through the portal. The data exists; the portal does not.

Guardian access is particularly important for faith-based K–12 schools, children's ministries, and
Bible schools serving younger students. FERPA applies to students 18 and older at institutions that
receive federal funding; for students under 18, parents retain access rights. This ADR must respect
both the FERPA model and the pastoral context.

---

## Decision

### 1. Authentication

Guardians authenticate via the same Supabase SSR session as other users. A guardian account is a
Supabase Auth user with role `guardian`. Guardian accounts are created by admins or through a
guardian invitation flow (invite email → set password → guardian portal).

No separate auth system. No guest access. Guardians must have a verified account.

### 2. Guardian-student relationship enforcement

Guardian visibility is scoped to students linked in `academy_guardian_students`:

- `guardian_person_id`
- `student_person_id`
- `tenant_id`
- `relationship_type` (parent, stepparent, legal_guardian, other)
- `ferpa_rights`: boolean — whether this guardian holds FERPA rights for this student
- `active`: boolean

Every guardian API route must include the condition:
```sql
guardian_person_id = auth.uid()
```
This is enforced at the service layer using `withAcademyDatabaseContext`. Application-layer filtering
alone is not sufficient.

**Wildcard condition from Council Review X:** a guardian must not be able to query another guardian's
student by passing a `studentId` that is not in their relationship table. The service layer enforces
this via a cross-join on `academy_guardian_students`, not by trusting the request parameter.

### 3. Guardian portal surfaces

The guardian portal at `/guardian` provides:

**Dashboard** — linked student cards, each showing:
- Student name, program, enrollment status
- Current GPA (if grades have been posted and are not held)
- Attendance summary (attendance percentage for current term)
- Notification badge if attendance alerts are active

**Student detail** (per linked student):
- Attendance: session-by-session view, absences highlighted
- Grades: section grades (not per-assignment details unless section grade is posted)
- Billing: payment plan status and installment due dates (view-only, no pay button)
- Communications: absence alert preferences

**Explicit exclusions:**
- Ministry Formation Records are **never** shown to guardians (pastoral privacy — ADR-0045)
- Advisor notes are **never** shown to guardians (ADR-0049)
- Student PWA actions are not available to guardians (guardians observe, not transact)
- Guardians cannot initiate registration changes, transcript requests, or aid acceptance on behalf
  of students; they may contact the institution through the contact details surface only

### 4. FERPA rights flag

Guardians with `ferpa_rights = false` see a restricted view:
- Attendance summary only (no grade details)
- No billing information
- A banner: "Your access to this student's records is limited. Contact the institution for details."

Guardians with `ferpa_rights = true` see the full guardian portal surface.

FERPA rights are toggled by registrars only via the admin student detail view.

### 5. Minor-only vs 18+ rule

If the student's `date_of_birth` indicates they are 18 or older, the guardian portal shows a notice:
"This student is an adult. Record access requires their explicit written consent on file."
The guardian continues to see the same surfaces; the notice is informational. Institutions that require
explicit consent from adult students to grant guardian access must enforce that policy outside the system
(consent form on file) — the system does not technically block access for 18+ students because some
institutions grant ongoing parental access through institutional policy.

### 6. API routes

- `GET /api/academy/guardian/students` — list linked students (`guardian_person_id = auth.uid()`)
- `GET /api/academy/guardian/students/[studentId]/attendance` — attendance for linked student only
- `GET /api/academy/guardian/students/[studentId]/grades` — grade summary for linked student only
- `GET /api/academy/guardian/students/[studentId]/billing` — billing view for linked student only
- `PATCH /api/academy/guardian/students/[studentId]/notification-preferences` — alert opt-out

---

## Consequences

- Guardians can monitor their linked students without contacting the institution for each update.
- The cross-join relationship enforcement prevents unauthorized cross-guardian data access.
- Ministry Formation Records and advisor notes remain protected from guardian view.
- The FERPA rights flag gives registrars granular control over what each guardian can see.

---

## Alternatives Considered

**Let guardians share a login with the student:**
Rejected. Shared credentials cannot be audited. If a student revokes access, a separate account
model is required.

**Build a separate auth system for guardians:**
Rejected. Maintaining two auth systems creates operational burden and a larger attack surface.
Supabase SSR handles all roles uniformly.

---

## Security / Privacy Review Notes

- Every guardian API route must validate `guardian_person_id = auth.uid()` via a cross-join on the
  relationship table at the service layer. Client-passed `studentId` parameters are inputs to the
  relationship check, not trust anchors.
- Ministry Formation Record table must never be queried in a guardian route, even with a where clause.
- Advisor note table must never be queried in a guardian route.
- Session management is identical to all other roles — no weakened session for guardians.

---

## Related

- ADR-0045 — Ministry Formation Records model and privacy boundary
- ADR-0049 — Student record editable fields and advisor notes audit model
- ADR-0053 — Attendance enforcement and guardian absence notification
- ADR-0055 — Student PWA full self-service (guardian observer vs student actor distinction)
