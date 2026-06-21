# Course Registration Operations Runbook

## Purpose

Operate the accepted-admission to course-section registration workflow for ChurchCore Academy.

## Required Roles

The registration confirmation API accepts:

- `institution_admin`
- `dean`
- `registrar`
- `academic_admin`
- `admissions`

Student PWA reads use the signed-in student identity and relationship access rules.

## Confirmation Workflow

1. Confirm the application has status `accepted`.
2. Confirm the application has already been converted into:
   - student profile
   - program enrollment
   - period registration
3. Submit enrollment confirmation with:
   - application id
   - course section id
   - `Idempotency-Key`
4. The service evaluates section eligibility.
5. If eligible, the system writes:
   - `academy_course_section_registrations`
   - `academy_enrollment_confirmation_events`
6. Staff review the resulting roster on Admin > Sections.
7. The student sees the confirmed course and schedule in the Student PWA.

## Expected Rejections

- Application is not accepted.
- Application has not been converted.
- Course section does not match the student period registration.
- Course section is not open.
- Registration window is closed.
- Section capacity is full.
- Student already has an active registration for the section.
- Prerequisites are unmet.
- Holds are active once the holds domain is connected.

## Audit

Registration confirmation writes immutable enrollment-confirmation events. The event vocabulary supports:

- `created`
- `waitlisted`
- `confirmed`
- `withdrawn`
- `override`

Current confirmation writes a `confirmed` event. Future add/drop and override operations should use the same event table.

## Troubleshooting

If a staff user receives a conflict:

- Verify the admission conversion record is complete.
- Verify an enrollment window exists for the section academic period.
- Check active registration count against section capacity.
- Check whether the same student already has `pending_confirmation`, `registered`, or `waitlisted` status for the same section.
- Check prerequisite records for the target course.

If the Student PWA schedule is empty:

- Confirm the signed-in user has a student profile in the tenant.
- Confirm the student has `pending_confirmation`, `registered`, or `waitlisted` course-section registrations.
- Confirm the course section joins to an academic period and course.
