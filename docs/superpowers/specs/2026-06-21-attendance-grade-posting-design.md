# Attendance And Production Grade Posting Design

Date: 2026-06-21
Governing ADR: ADR-0033 Full SIS Competitive MVP Release Program
Slice: 2

## Purpose

Move daily academic operations beyond screen-only coverage by making attendance entry and registrar grade posting enforce real role, roster, and release rules.

## Scope

In scope:

- Faculty/admin attendance capture for actively registered students.
- Attendance write authorization for assigned faculty or academic administrators.
- Student attendance read guard for self-only access unless staff role is present.
- Registrar/admin grade posting state on gradebook records.
- Immutable grade posting event log.
- Student gradebook release filtering so students see only posted and released records.
- Admin Gradebook registrar posting queue.

Out of scope:

- Attendance-based billing or financial-aid impacts.
- Final transcript issuance.
- LMS grade-return auto-posting.
- Complex attendance session templates.

## Data Boundary

Attendance writes remain in `academy_attendance_records`.

Grade posting adds:

- `academy_gradebook_records.posting_status`
- `academy_gradebook_records.posted_at`
- `academy_gradebook_records.posted_by_person_id`
- `academy_gradebook_records.released_to_student_at`
- `academy_gradebook_posting_events`

All operations run under `requireActor()` and `withAcademyDatabaseContext()` through tenant-scoped RLS.

## Runtime Behavior

1. Faculty enters attendance from the faculty attendance screen.
2. The API resolves the verified Academy actor.
3. `AttendanceService` verifies role, section ownership, and active student registration.
4. The repository upserts the attendance record.
5. Faculty enters grades through existing gradebook workflows.
6. Registrar/admin reviews draft grades in Admin Gradebook.
7. Registrar posts the grade, writes immutable posting evidence, and releases it to the student.
8. Student gradebook reads filter out unposted or unreleased grades.

## Acceptance Criteria

- Student actors cannot write attendance.
- Faculty cannot write attendance for unassigned sections.
- Attendance cannot be recorded for a student without active section registration.
- Registrar/admin can post a grade and write audit evidence.
- Faculty cannot post official grades.
- Student gradebook reads include only posted and released records.
- Migration creates posting state and immutable posting events.
- Admin Gradebook exposes a posting queue.
