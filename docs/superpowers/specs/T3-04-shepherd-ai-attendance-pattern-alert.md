# Story: ShepherdAI Attendance Pattern Early-Alert Signal
**ID:** T3-04
**Tier:** 3 — Achieve Competitive Differentiation
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story
As an academic advisor, I want ShepherdAI to automatically flag students who have missed more than a configurable percentage of class meetings in any section so I can reach out before they fall too far behind to recover.

## Background
Attendance data is collected and stored in `academy_attendance_records`. ShepherdAI has no signal that reads it. The GPA-drop signal (T1-04) catches grade problems after the fact. Attendance-pattern detection catches problems early — typically 3–4 weeks before a grade problem materializes. This is the highest-ROI early alert signal for student retention.

## Acceptance Criteria
1. A `computeAttendanceRateSignal(tenantId, sectionId, client)` function runs after each attendance session is marked.
2. For each student in the section, it computes: `absences / total_meetings_held` as a rate.
3. If rate > institution's `attendance_alert_threshold_pct` (default 20%): generates a `academic_standing_or_credit_progress_review` suggestion for that student with context: section name, instructor, absences, total meetings, rate, most recent absence date.
4. Urgency: `high` if rate > 30%, `medium` if 15–30%.
5. Signal includes explainability text: "This student has missed X of Y class meetings in [Section Name] (Z%). This exceeds the institution threshold of T%."
6. If an existing open suggestion already exists for this student+section+signal combination: update it (new absence count and rate) rather than creating a duplicate.
7. When student's absence rate drops below the threshold (e.g., after excused reclassification): existing suggestion is auto-resolved.

## Edge Cases
- Section with 1 meeting held and student absent: 100% absence rate — signal fires but urgency notes "low sample size: only 1 meeting held."
- Student on an approved leave of absence: signal suppressed (check enrollment status before firing).
- Faculty marks attendance retroactively for a past date: signal recomputed.
- Excused absence: institution config determines whether excused absences count toward the threshold.
- Student in 5 sections all above threshold: 5 separate signals, not one combined signal.

## Out of Scope
- Predictive absence modeling (future absences) — not deterministic, not in ADR-0022 boundary
- Automatic grade penalty enforcement
- Guardian notification (that is T2-10)

## Role Matrix
| Role | Signal Visible | Dismiss Signal | Configure Threshold |
|------|:--------------:|:--------------:|:------------------:|
| Admin | ✓ (all students) | ✓ | ✓ |
| Registrar | ✓ (all students) | ✓ | ✓ |
| Advisor | ✓ (their advisees) | ✓ | ✗ |
| Faculty | ✓ (their sections) | ✗ | ✗ |
| Student | ✗ | ✗ | ✗ |
| Guardian | ✗ | ✗ | ✗ |

## Technical Notes
- Signal type: `academic_standing_or_credit_progress_review` (existing) — use subtype or context field to distinguish attendance vs GPA signals
- Location: extend `src/modules/shepherd-ai/signals/` or equivalent — follow existing signal pattern
- Trigger: called from attendance service after session is saved
- Deduplication: check `academy_shepherd_ai_suggestions` for existing open suggestion with same student + section + signal type before inserting
- Threshold config: `academy_institution_configs` key `attendance_alert_threshold_pct`
- Dependency: T2-10 attendance enforcement and this signal can share the same threshold computation

## Tests Required
- `computeAttendanceRateSignal()` below threshold: no suggestion created.
- `computeAttendanceRateSignal()` at warning threshold: suggestion created with `urgency: medium`.
- `computeAttendanceRateSignal()` at alert threshold: suggestion created with `urgency: high`.
- `computeAttendanceRateSignal()` update existing: existing suggestion updated, not duplicated.
- `computeAttendanceRateSignal()` student on leave: suggestion suppressed.
- `computeAttendanceRateSignal()` rate drops below threshold: existing suggestion auto-resolved.
- Cross-tenant rejection: signal cannot be created for another tenant's students.
- Explainability text: signal text contains section name, absence count, rate, threshold.
