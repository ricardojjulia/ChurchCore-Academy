# Story: Attendance Threshold Enforcement and Guardian Absence Notifications
**ID:** T2-10
**Tier:** 2 — Complete Core SIS Workflows
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story
As an academic dean, I want the system to automatically alert guardians and flag students when their absence rate exceeds a configurable threshold so that at-risk students are identified and families are informed before the situation becomes unrecoverable.

As a guardian, I want to receive an email when my student misses class so I am informed in a timely manner and can follow up with the student.

## Background
`academy_attendance_records` is populated by faculty. The admin page shows per-section aggregate counts. No enforcement or alerting exists — a student could miss every class with no automatic response from the system. Guardian notification infrastructure (communications queue, email worker from T1-02) must be in place before this story can ship.

## Acceptance Criteria
1. After each attendance session is marked, a background check runs: if a student's absence rate for a section crosses the warning threshold (default 15%, configurable per institution), a ShepherdAI `academic_standing_or_credit_progress_review` suggestion is generated.
2. If absence rate crosses the alert threshold (default 25%, configurable), the student's guardian(s) receive an automated email notification via the communications queue.
3. Guardian notification content: student name, section name, instructor, absence count, total meetings, absence rate, institution contact information.
4. Notification is sent at most once per student per section per week (deduplication — not on every attendance entry).
5. Institution admin can configure thresholds (warning %, alert %) per institution.
6. Admin attendance page shows which students have triggered threshold alerts.
7. Excused absences are counted separately — institution admin configures whether excused absences count toward the threshold (default: no).

## Edge Cases
- No guardian on file for student: ShepherdAI signal still fires; email notification is skipped; admin sees "No guardian on file" note on the flag.
- Guardian email bounced: failure logged; next threshold crossing triggers a new attempt.
- Student has 100% absences (never attended): signal fires at first crossing, not repeatedly.
- Section with only 1 meeting: 1 absence = 100% rate; threshold fires but admin should review context — signal generates but with a "low meeting count" note.
- Student's guardian has opted out of communications: email skipped; ShepherdAI signal still fires.
- Term ends with student still above threshold: signal automatically resolved after term close.

## Out of Scope
- SMS notifications (Tier 4)
- Automatic grade penalty for attendance (institution-specific policy, not automated)
- Court-mandated attendance reporting (Tier 4)

## Role Matrix
| Role | Configure Thresholds | View Flags | Receive Guardian Notification | Dismiss Signal |
|------|:-------------------:|:----------:|:----------------------------:|:--------------:|
| Admin | ✓ | ✓ | ✗ | ✓ |
| Registrar | ✗ | ✓ | ✗ | ✓ |
| Faculty | ✗ | Own sections | ✗ | ✗ |
| Guardian | ✗ | ✗ | ✓ (their student) | ✗ |
| Student | ✗ | Own summary | ✗ | ✗ |

## Technical Notes
- Threshold check: run after `markAttendance()` in the attendance service
- Threshold config: new `academy_institution_configs` key `attendance_warning_threshold_pct` and `attendance_alert_threshold_pct`
- Guardian lookup: join `academy_student_relationships` where `relationship_type` includes guardian role and communication consent is active
- Deduplication: check `academy_communications_messages` for existing guardian notification for same student/section within last 7 days
- ShepherdAI signal: reuse `academic_standing_or_credit_progress_review` signal type with attendance context in the suggestion text
- Dependency: T1-02 (email delivery) must be live before guardian email notifications can work; ShepherdAI signal fires independently

## Tests Required
- `checkAttendanceThreshold()` below threshold: no signal, no email.
- `checkAttendanceThreshold()` at warning threshold: ShepherdAI signal created.
- `checkAttendanceThreshold()` at alert threshold: signal created + guardian email enqueued.
- Deduplication: second threshold crossing within 7 days does not enqueue second email.
- No guardian: signal fires, no email enqueued, no error thrown.
- Opted-out guardian: signal fires, email skipped.
- Excused absence config = false: excused absences excluded from rate calculation.
- Cross-tenant rejection: attendance check cannot create signals for another tenant's students.
