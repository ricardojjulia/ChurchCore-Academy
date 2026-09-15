# Story: Ministry Formation Records

**ID:** T3-01
**Tier:** 3 — Achieve Competitive Differentiation
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story

As a seminary or Bible school faculty member, I want to record ministry practicum hours, pastoral
evaluations, and faith milestones for each student so I can track their formation as a minister,
not just their academic performance.

As a student, I want to see my own ministry formation record — including practicum hours logged,
milestones reached, and formation evaluations — so I understand my progress toward ministry
credentials and can reflect on my development.

So that: institutions can produce a complete picture of ministerial readiness that no academic
transcript alone can show, and students have a single authoritative record of their formation
journey.

## Background

No SIS competitor — Populi, Sycamore, FACTS, or any other — has ever built a structured ministry
formation record system. All competitors treat spiritual and ministerial development as
out-of-scope, leaving Bible schools and seminaries to track it in spreadsheets, paper files, or
disconnected church software. Ministry Formation Records are the single most defensible
differentiating feature ChurchCore Academy can build. They are the story we tell at every seminary
sales meeting. The domain must be built as a first-class module under `src/modules/ministry-formation/`
with the same privacy discipline as official academic records.

## Acceptance Criteria

1. A faculty member with role `faculty`, `advisor`, or `admin` can log a practicum session for a
   student, recording: hours (positive decimal), site name, supervisor name, session date, and an
   optional reflection note written by the student.
2. A faculty member or admin can record a formation evaluation for a student, selecting a rubric
   (institution-configured), assigning scores per rubric criterion, and adding pastoral notes. The
   evaluating faculty member's identity is recorded and immutable once saved.
3. An admin can record a faith milestone for a student: milestone type, date, witness name(s), and
   institution notes. Milestone types include at minimum: `baptism`, `ordination`,
   `ministry_practicum_completion`, `spiritual_formation_review`, `pastoral_endorsement`, and
   `custom`.
4. A student can view their own formation record in the student PWA: practicum hours total and
   per-session log (date, site, hours), milestones list (type, date), and formation evaluations
   (rubric scores only — pastoral notes are NOT visible to the student). The student cannot edit
   any formation record entry.
5. An admin can endorse/finalize a formation record entry. Once endorsed, the entry is immutable:
   no edits or deletions are permitted at the application layer. Endorsed entries display a
   finalization badge with the endorsing admin's name and endorsement date.
6. Practicum logs are visible to: the student (own record), the recording supervisor, and any
   admin. Guardian visibility is controlled by the institution's `StudentRelationshipVisibility`
   policy and defaults to `progress` or higher.
7. Pastoral notes on formation evaluations are visible to: the evaluating faculty member and
   admins only. They are never surfaced to the student, guardian, or other faculty.
8. A transferring student can have formation credit from another institution recorded by an admin,
   with fields: source institution name, credit type (practicum hours / milestone / evaluation),
   amount or description, and transfer date. Transfer records are flagged distinctly from
   internally-recorded records.
9. When a student withdraws from a program, their formation record is preserved in full. Access is
   restricted to admins only; the student's own PWA access to the record is suspended.
10. The institution can configure custom milestone types and evaluation rubrics through the
    institution configuration panel.
11. All writes to formation records produce an immutable audit event in the audit log (ADR-0019).
12. All module functions enforce tenant isolation: a person from tenant A cannot read or write
    formation records belonging to tenant B.

## Edge Cases

- Endorsed record edit attempt: any write to a finalized entry returns a `409 Conflict` with a
  safe message; no partial update occurs.
- Student who transfers formation credit with the same milestone type they already have internally
  recorded: both records are preserved; the admin is shown a warning but not blocked.
- Faculty member who evaluated a student is later deactivated: the evaluation record retains the
  original evaluator's person ID and display name snapshot; deactivation does not change the
  historical record.
- Student with `guardianRequired: true` whose guardian has only `directory_only` visibility: the
  guardian sees no formation records; formation is not a directory-only category.
- Admin attempts to record a practicum session with 0 hours: validation rejects with a clear
  message — hours must be greater than 0.
- Student has formation records across two programs in the same tenant (e.g., transferred between
  programs): records from both programs are visible in the student's complete formation view.
- Institution has `bible_school` mode with no rubric configured: formation evaluations are
  unavailable for that mode until a rubric is configured; practicum logging and milestones remain
  available.

## Out of Scope

- External ordination body integration or credential verification API (Tier 4 / denomination
  integration).
- PDF export of the formation record (covered by the transcript PDF story T2-08 extension).
- Student ability to submit self-assessment forms or reflection notes as structured data (may be
  a future Tier 4 item).
- Formation record sharing with another institution via API (Tier 4).
- FERPA analysis of pastoral notes — institutional policy governs; this story enforces the
  technical boundary only.

## Role Matrix

| Action | `student` (own record) | `guardian` | `faculty` / `advisor` | `admin` |
|---|---|---|---|---|
| View practicum log | Yes | Policy-gated (`progress`+) | Yes (own sections) | Yes |
| View milestones | Yes | Policy-gated (`progress`+) | Yes | Yes |
| View evaluation rubric scores | Yes | No | Yes (own evaluations) | Yes |
| View pastoral notes | No | No | Yes (own evaluations) | Yes |
| Log practicum session | No | No | Yes | Yes |
| Record milestone | No | No | No | Yes |
| Record formation evaluation | No | No | Yes | Yes |
| Endorse / finalize entry | No | No | No | Yes |
| Record transfer credit | No | No | No | Yes |
| Configure rubrics / milestone types | No | No | No | Yes (institution admin) |

## Technical Notes

- New module: `src/modules/ministry-formation/` following the pattern of `src/modules/attendance/`
  and `src/modules/financial-aid/`.
- Key types to define: `MinistryFormationRecord`, `PracticumSession`, `FormationEvaluation`,
  `FormationEvaluationRubric`, `FaithMilestone`, `MinistryFormationTransferCredit`,
  `MilestoneType` (enum), `FormationRecordStatus` (`draft` | `endorsed`).
- Endorsement immutability is enforced at the repository layer: endorsed records return early
  with a `PermanentRecordError` before any DB write is attempted.
- Pastoral notes must never appear in any student-facing read model or PWA route response.
  Verify with `doesNotMatch` on `pastoralNote` in tests.
- Institution-mode gate: formation record availability should respect `InstitutionCapabilitySet`.
  Bible schools and seminaries have it enabled; children's schools do not by default.
- ADR-0045 (Ministry Formation Records model and privacy boundary) must be written and accepted
  before implementation begins.
- Supabase migrations: new tables `ministry_practicum_sessions`, `ministry_formation_evaluations`,
  `ministry_formation_milestones`, `ministry_formation_transfer_credits`. All have `tenant_id`
  as first composite key component, enforced with foreign keys to `tenants`.
- `withAcademyDatabaseContext` wraps all repository writes per ADR-0018.

## Tests Required

Per CLAUDE.md conventions, `src/modules/ministry-formation/__tests__/` must include:

- **Success:** log practicum session returns `PracticumSession` with correct hours and tenant.
- **Success:** record milestone returns `FaithMilestone` with correct type and date.
- **Success:** record formation evaluation returns rubric scores; pastoral note present on record.
- **Validation:** zero-hours practicum attempt throws with message matching `/hours must be greater than 0/i`.
- **Validation:** missing session date throws with required-field message.
- **Cross-tenant rejection:** actor from tenant A cannot read formation records of a student in tenant B.
- **Endorsement immutability:** write to an endorsed entry throws `PermanentRecordError`; record unchanged.
- **Privacy boundary:** student-facing read model for evaluations does NOT contain `pastoralNote`
  field (assert with `doesNotMatch`).
- **Withdrawal access restriction:** withdrawn student's formation record read returns `null` for
  student-role actor; admin actor receives the full record.
