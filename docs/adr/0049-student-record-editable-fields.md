# ADR-0049 — Student Record Editable Fields and Advisor Notes Audit Model

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`

---

## Context

The student records module supports reading student profiles, but no fields can be edited by students
or staff through the UI. Advisor notes do not exist. There is no audit trail for field changes.

Faith-based institutions have pastoral obligations around student records. An advisor notes field is
not merely administrative — it carries pastoral guidance, spiritual progress observations, and
disciplinary notes. Access to advisor notes must be strictly role-gated.

---

## Decision

### 1. Student-editable contact fields

Students may update the following fields on their own profile via the student PWA at `/account`:

- `preferred_name`
- `phone`
- `email` (secondary contact email; primary email is tied to Supabase Auth and cannot change here)
- `address` (street, city, state, postal code, country)
- `emergency_contact_name`
- `emergency_contact_phone`
- `emergency_contact_relationship`

Every field change emits an immutable audit event via the ADR-0019 pattern with `actor_id`,
`field_changed`, `old_value_hash`, and `new_value`. Raw PII is not stored in the audit event;
old values are SHA-256 hashed.

### 2. Registrar/admin-editable fields

Registrars and admins may additionally edit:

- `enrollment_status` (active, leave_of_absence, withdrawn, graduated)
- `program_id`
- `advisor_person_id`
- `holds` (add/remove hold codes with reason)

Enrollment status changes and hold changes both emit audit events with the actor's person_id
and a required reason string.

### 3. Advisor notes

Add `academy_advisor_notes` table:

- `id`, `tenant_id`, `student_person_id`
- `author_person_id` — must have `advisor` or `registrar` or `admin` role
- `note_text` — free text, max 4000 characters
- `note_type`: `academic` | `pastoral` | `financial` | `disciplinary` | `general`
- `created_at`
- `visible_to_student` — boolean, default false; advisor explicitly marks notes the student may read

Advisor notes are **append-only**. A note may not be edited or deleted after creation. If a correction
is needed, a new note is added referencing the original note ID.

**Access rule:** advisor notes are never returned to the student unless `visible_to_student = true`.
The student API route filters by this flag before returning. Staff with `advisor`, `registrar`, or
`admin` role see all notes for their tenant's students.

**Guardian access:** guardians do not see advisor notes, regardless of the `visible_to_student` flag.
Notes surface only in the staff and student views.

### 4. API routes

- `PATCH /api/academy/students/[id]/profile` — student-editable fields only; actor must be the student
- `PATCH /api/academy/students/[id]/enrollment` — registrar/admin fields; requires registrar or admin role
- `POST /api/academy/students/[id]/advisor-notes` — create advisor note; requires advisor/registrar/admin role
- `GET /api/academy/students/[id]/advisor-notes` — list notes; filters by `visible_to_student` for student actor

---

## Consequences

- Students can keep their contact information current without registrar intervention.
- Advisor notes provide a persistent pastoral record that follows the student through their academic career.
- The append-only note model prevents retroactive record falsification, satisfying accreditation standards.
- The `visible_to_student` flag gives advisors control over what students see without exposing all notes.

---

## Alternatives Considered

**Allow editing of advisor notes:**
Rejected. Advisor notes are part of the student's official academic record. Editability would undermine
their value as evidence in accreditation audits and dispute resolution.

**Store advisor notes in the student profile JSON column:**
Rejected. Querying, filtering, and auditing notes requires structured rows, not a JSON blob.

**Let guardians see all advisor notes:**
Rejected. Notes may contain pastoral disclosures the student has not shared with family. The advisor's
explicit `visible_to_student` flag is the only gate for note visibility.

---

## Security / Privacy Review Notes

- Advisor notes with `note_type = pastoral` or `disciplinary` are especially sensitive. The role gate
  must be enforced at the repository layer, not only at the route layer.
- Every create/update on student-editable fields must produce an audit event.
- PII in old field values must be hashed in audit records, not stored in plaintext.

---

## Related

- ADR-0019 — Immutable audit events and outbox boundary
- ADR-0011 — Official record transcript and audit model
