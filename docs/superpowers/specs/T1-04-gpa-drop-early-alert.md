# Story: ShepherdAI GPA-Drop Early-Alert Signal

**ID:** T1-04
**Tier:** 1 — Unblock Basic Operations
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story

As an academic advisor or registrar, I want ShepherdAI to automatically flag students whose
cumulative GPA drops below a configurable threshold immediately after a grade is posted, so that I
can intervene before the student reaches the formal academic dismissal threshold and faces
consequences that could have been avoided.

So that: the ShepherdAI queue is not only populated by manual re-evaluation but fires automatically
when a grade event creates an academic standing risk, giving the institution a proactive tool that
no competitor currently offers.

## Background

ShepherdAI already supports the `academic_standing_or_credit_progress_review` workflow code and
the signal type `credit_progress_gap`. The `signal-aggregator.ts` already reads `student.gpa` and
compares it against `dataset.thresholds.minimumGpa` (line 104). The `workflow-recommender.ts`
already maps this to a suggestion with `workflowCode: "academic_standing_or_credit_progress_review"`
(line 74). However, this signal only fires when a staff member manually triggers
`/api/academy/shepherd-ai/evaluate`. No automatic evaluation runs after grade posting.

The `grading-records` module has an `official-record-evaluator.ts` and
`academic-standing-evaluator.ts`. The `gradebook` module has a grade posting workflow. This story
connects grade posting → GPA computation → ShepherdAI signal fire → suggestion in queue without
requiring staff to click "Re-evaluate."

## Acceptance Criteria

1. When a grade is posted and marked `released` for a student in a tenant that has GPA tracking
   enabled (`supportsGpa = true` on `GradingProfile`), a GPA-drop check is triggered
   automatically for that student.
2. If the student's computed cumulative GPA falls below the institution's configured warning
   threshold (default `2.0`, configurable per tenant in `AcademyConfig` or `GradingProfile`), a
   ShepherdAI suggestion is created with `workflowCode: "academic_standing_or_credit_progress_review"`.
3. The suggestion urgency is `high` if `gpa < 1.5`, and `medium` if `1.5 <= gpa < threshold`.
4. The suggestion summary text includes: the student's name, the course section that caused the
   drop, the previous GPA (or "no prior GPA" for first graded course), and the current GPA.
   Example: "Student Jane Doe's cumulative GPA dropped from 2.8 to 1.9 after posting a D in
   THEO 201. Current GPA is below the 2.0 warning threshold."
5. The suggestion appears in the admin workflow queue within one page load after grade posting
   (the suggestion is written to Postgres before the grade-post API returns a 200 to the client).
6. If a suggestion for this student with `workflowCode: "academic_standing_or_credit_progress_review"`
   and `status = 'suggested'` already exists in the queue, the existing suggestion is updated
   (summary refreshed, urgency recalculated) rather than a duplicate being created.
7. If the student is on record as being on approved academic probation (flag stored on the student
   profile or an academic standing record), the suggestion still fires but the summary includes a
   note: "Note: student is currently on approved academic probation."
8. If the student's GPA later rises above the warning threshold (after a correction or additional
   grade posting), any active `suggested` or `promoted_to_workflow` suggestion for this student is
   resolved: `status` is set to `resolved` on the suggestion.

## Edge Cases

- Student with no graded courses yet (first grade ever posted): no GPA can be computed; no signal
  fires. The grade posting API does not error; it simply skips the ShepherdAI evaluation.
- Student on approved academic probation: signal still fires (Acceptance Criterion 7). The signal
  never suppresses itself based on probation status — advisors must still see the alert.
- Student's GPA improves above threshold after remediation: existing suggestion is resolved
  (Acceptance Criterion 8). The suggestion record is not deleted; it is archived with
  `status = 'resolved'` so the intervention history is preserved.
- The GPA computation fails (e.g., missing grading scale): the grade posting API does not fail.
  The GPA check is treated as a best-effort side effect. Log the failure to the `observability`
  module; do not propagate the error to the staff member posting the grade.
- Tenant has `supportsGpa = false` (competency or attendance-only grading): GPA-drop signal check
  is skipped entirely. No suggestion is created. No error.
- Two grades posted in rapid succession for the same student: both trigger the check. The second
  evaluation overwrites the first suggestion (upsert by student entity ID and workflow code).
- The configured warning threshold is set to `0.0` (effectively disabled): no suggestions fire
  since no GPA can fall below 0.0. Treat as a disabled signal.

## Out of Scope

- Predictive GPA modeling (forecasting what GPA will be after the current term ends).
- AI-generated intervention text or suggested intervention scripts.
- Attendance-based early alert signal (Tier 3, T3-05).
- Academic standing watchlist with configurable multi-factor trigger thresholds (Tier 3, T3-06).
- Automatic email notification to the advisor when this suggestion fires (this story creates the
  suggestion in the queue; email delivery is T1-02 and requires a separate communications trigger).
- Bulk GPA-drop evaluation across all students on a schedule (only grade-post-triggered for T1).

## Role Matrix

| Role | See GPA-drop suggestions | Take action on suggestions | Configure warning threshold |
|------|:------------------------:|:--------------------------:|:---------------------------:|
| institution_admin | Yes (all students) | Yes | Yes |
| registrar | Yes (all students) | Yes | Yes |
| academic_admin | Yes (all students) | Yes | Yes |
| dean | Yes (all students) | Yes | No |
| admissions | No | No | No |
| faculty | Yes (students in their sections only) | No | No |
| student | No | No | No |
| guardian | No | No | No |

Note: the warning threshold configuration UI is out of scope for T1. For T1, the threshold is a
constant (default `2.0`) that can be overridden via institution config. The config UI is Tier 2.

## Technical Notes

- Key files to read before implementation:
  - `src/modules/shepherd-ai/signal-aggregator.ts` — existing GPA threshold check at line 104
  - `src/modules/shepherd-ai/workflow-recommender.ts` — `academic_standing_or_credit_progress_review`
    mapping at line 74; the `whyItSurfaced` text to update at line 85
  - `src/modules/shepherd-ai/types.ts` — `SignalType`, `WorkflowCode`, `Urgency`, `SuggestionStatus`
  - `src/modules/shepherd-ai/postgres-repository.ts` — `saveSuggestions`, `updateSuggestionStatus`,
    `fetchSuggestions`
  - `src/modules/grading-records/academic-standing-evaluator.ts` — existing standing evaluation;
    the GPA computation logic that feeds this story
  - `src/modules/grading-records/types.ts` — `GradingProfile.supportsGpa`, `StandingType`
  - The grade-posting API route (`src/app/api/academy/gradebook/` or similar) — must add the
    ShepherdAI trigger call after a successful grade post
- The GPA-drop check must be implemented as a domain service function, not called directly from
  the API route. The API route calls: `gradingService.postGrade(...)` then
  `shepherdAiEvaluator.evaluateStudentGpa(tenantId, studentPersonId)` as a non-blocking side
  effect. If the evaluator throws, log and continue — do not fail the grade post.
- The suggestion upsert must be by `(tenant_id, entity_id, workflow_code)` where `entity_id` is
  the student's person ID. If a suggestion with that key already exists and has `status` of
  `suggested` or `promoted_to_workflow`, update its `summary`, `urgency`, `confidence_score`, and
  `generated_at`. If `status` is `dismissed` or `resolved`, create a new suggestion (the staff
  member may have closed the previous one legitimately).
- The warning threshold default (`2.0`) must be defined as a named constant in the
  `shepherd-ai` module, not hardcoded inline. The institution-specific override can be added in
  Tier 2 as part of T2-06 (GPA calculation engine).
- Do not call the ShepherdAI evaluator from the UI component or the read model. It must only be
  called from the grade-posting API route after the grade record is committed.
- The suggestion `explanation.detected` array should include: `["GPA below warning threshold"]`.
  The `explanation.whySurfaced` array should include: `["Grade posted in [section name] resulted in
  cumulative GPA of [X], below the [Y] warning threshold."]`.

## Tests Required

- `src/modules/shepherd-ai/__tests__/gpa-drop-signal.test.ts`:
  - Success `high` urgency: student GPA drops to 1.3 (below 1.5); suggestion created with
    urgency `high` and `workflowCode: "academic_standing_or_credit_progress_review"`.
  - Success `medium` urgency: student GPA drops to 1.8 (between 1.5 and 2.0); suggestion created
    with urgency `medium`.
  - No signal: student GPA is 2.5 (above threshold); no suggestion is created.
  - No signal: student has no graded courses; no signal fires, no error thrown.
  - Tenant with `supportsGpa = false`: no suggestion is created.
  - Upsert: existing `suggested` suggestion for same student is updated, not duplicated.
  - Probation note: student flagged as on probation; suggestion is created and summary includes
    probation note.
  - GPA recovery: student GPA rises above threshold; existing `suggested` suggestion is resolved.
  - Cross-tenant isolation: signal evaluation for tenant A does not read or write tenant B data.
