# Attendance And Grade Posting Operations Runbook

## Attendance Capture

Authorized attendance writers:

- `institution_admin`
- `dean`
- `registrar`
- `academic_admin`
- `faculty`
- `teacher`
- `professor`

Before attendance is saved, the system verifies:

- the actor has an attendance-write role
- the actor is assigned to the section unless they are academic administration
- the student has an active course-section registration

Expected failures:

- student or guardian attempts to write attendance
- faculty attempts to write outside assigned sections
- attendance is submitted for a student not registered in the section

## Grade Posting

Faculty grade entry creates or updates gradebook records, but records remain draft for official release until registrar review.

Authorized posting roles:

- `institution_admin`
- `dean`
- `registrar`
- `academic_admin`

Posting behavior:

1. Registrar reviews draft records in Admin > Gradebook.
2. Registrar posts a grade.
3. The system updates posting state to `posted`.
4. The system records `posted_at`, `posted_by_person_id`, and `released_to_student_at`.
5. The system inserts an immutable `academy_gradebook_posting_events` record.
6. Student gradebook reads show only posted records with a release timestamp.

## Audit

Grade posting events are append-only. Do not update or delete rows from `academy_gradebook_posting_events`.

Posting event types:

- `posted`
- `held`
- `released`
- `revoked`

Current Slice 2 behavior writes `posted`.

## Troubleshooting

If attendance write fails:

- confirm the actor has a permitted role
- confirm the section instructor assignment
- confirm the student is registered in the section with `pending_confirmation` or `registered`

If a student cannot see a grade:

- confirm `academy_gradebook_records.posting_status = 'posted'`
- confirm `released_to_student_at` is not null
- confirm the student identity matches `learner_person_id`

If a registrar cannot post:

- confirm their Academy role is registrar, dean, academic admin, or institution admin
- confirm the grade record exists in the same tenant
- inspect `academy_gradebook_posting_events` for the last posting event
