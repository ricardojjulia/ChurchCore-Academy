# Story: Student Record Editable Fields
**ID:** T2-11
**Tier:** 2 — Complete Core SIS Workflows
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story
As an academic advisor, I want to add advisor notes to a student's record, update their enrollment status, and flag or clear academic holds so I can maintain accurate and actionable student records without needing database access.

## Background
The student profile page at `/admin/students/[id]` reads real data but every field is display-only. Advisors cannot record notes, change enrollment status, or manage holds. Any record update requires a direct database write. This prevents the system from functioning as a real SIS.

## Acceptance Criteria
1. **Advisor Notes:** Advisor can add a timestamped note to a student's record. Notes are append-only (displayed newest-first, existing notes cannot be edited or deleted). Each note shows author name and timestamp.
2. **Enrollment Status:** Admin and registrar can change a student's enrollment status (active, leave_of_absence, withdrawn, graduated, suspended, dismissed) via a dropdown with confirmation dialog. Each status change is logged as an immutable audit event.
3. **Academic Hold:** Admin and registrar can add a hold (type: financial, academic, administrative, disciplinary) with a note. Holds appear on the student profile and block transcript requests (T1-05) and registration (T2-09) per hold type. Holds can be cleared by authorized staff with a resolution note.
4. **Contact Information:** Admin and registrar can update student phone, address, and emergency contact. Students can update their own contact info from the PWA account page.
5. All changes are immediately reflected on the student profile page without a page reload (or on next navigation).

## Edge Cases
- Two advisors adding notes simultaneously: both notes are saved; last-write wins does not apply since notes are append-only.
- Status change to "graduated": triggers ShepherdAI resolution for any open graduation-readiness signals for this student.
- Adding a financial hold while student has pending registration: registration is not retroactively cancelled, but new registration attempts are blocked.
- Clearing a hold: requires a resolution note (cannot clear without explanation).
- Advisor attempts to delete a note: UI does not offer delete; API route rejects DELETE on notes.
- Student attempts to update enrollment status via PWA: 403 — status is admin-only.

## Out of Scope
- Document upload (academic, identity docs) — Tier 2 via T2-02 pattern
- Photo ID management (Tier 4)
- Grade override (separate registrar workflow, not a profile field)
- Financial hold clearance tied to payment — automatic clearance on payment (Tier 3 after T2-01 Stripe)

## Role Matrix
| Role | Add Note | Change Status | Add/Clear Hold | Edit Contact | View All |
|------|:--------:|:-------------:|:--------------:|:------------:|:--------:|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Registrar | ✓ | ✓ | ✓ | ✓ | ✓ |
| Advisor | ✓ | ✗ | ✗ | ✗ | ✓ |
| Faculty | ✗ | ✗ | ✗ | ✗ | Section students |
| Student | ✗ | ✗ | ✗ | Own contact | Own record |

## Technical Notes
- Module: `src/modules/people/` — extend student repository with `addAdvisorNote`, `updateEnrollmentStatus`, `addHold`, `clearHold`, `updateContactInfo`
- API routes: `POST /api/academy/students/[id]/notes`, `PATCH /api/academy/students/[id]/status`, `POST /api/academy/students/[id]/holds`, `DELETE /api/academy/students/[id]/holds/[holdId]`
- Audit events: enrollment status changes and hold add/clear must emit immutable events per ADR-0019
- New table: `academy_student_advisor_notes` (tenant_id, student_person_id, author_person_id, note_text, created_at)
- New table: `academy_student_holds` (tenant_id, student_person_id, hold_type, note, added_by, added_at, cleared_by, cleared_at, resolution_note)
- Holds integration: registration service and transcript request check `academy_student_holds` for active holds before proceeding

## Tests Required
- `addAdvisorNote()` success: note created with author and timestamp.
- `addAdvisorNote()` cross-tenant rejection: advisor on tenant A cannot note student on tenant B.
- `updateEnrollmentStatus()` success: status updated, audit event created.
- `updateEnrollmentStatus()` invalid transition (e.g., graduated → active): validate allowed transitions.
- `addHold()` success: hold created; subsequent transcript request blocked.
- `clearHold()` success: hold cleared with resolution note; transcript request now allowed.
- `clearHold()` without resolution note: validation error.
- Notes are append-only: no edit or delete route exists (404/405 if attempted).
