# ADR 0011: Official Record Transcript And Audit Model

Date: 2026-06-02
Status: accepted

## Context

Grade entry, narrative progress, competency completion, transcript posting, academic standing, promotion, and graduation audit are related but not identical workflows.

Instructors may submit evaluations, but registrars and academic administrators control official academic records. Children's schools may release progress reports to guardians without transcripts. Bible schools may issue completion records without GPA. Colleges, seminaries, and universities may need posted transcript entries, grade changes, holds, academic standing, and graduation audit.

If Academy treats every submitted grade as an official transcript entry, it will overexpose drafts, weaken registrar control, and make grade changes difficult to audit.

## Decision

ChurchCore Academy will separate evaluation results from official record entries.

The official record domain will use:

- `OfficialRecordRule` for transcript, progress, completion, report card, competency, attendance, graduation audit, and custom posting rules
- `OfficialRecordEntry` for registrar-posted student academic records
- `AcademicStandingRule` for good standing, warning, probation, promotion, retention, graduation-ready, and graduation-blocked calculations
- `AcademicRecordAuditEvent` for immutable history of posting, grade changes, holds, releases, superseding, voiding, standing, promotion, and graduation actions

Official record entries are immutable after posting except through superseding, voiding, or hold/release events. Transcript and graduation outputs read from posted official records, not from raw draft evaluations.

## Consequences

This supports:

- registrar-controlled transcript posting
- children's school progress and report-card release
- Bible school completion records
- seminary, college, and university transcripts
- grade-change audit history
- transcript holds and release controls
- deterministic promotion and graduation evaluation
- student and guardian PWA visibility rules based on release state

The tradeoff is that posting workflows require explicit state transitions and audit records. Implementation must be careful to prevent direct mutation of posted records.

## Alternatives Considered

Evaluation result equals official record:

- rejected because it overexposes drafts and weakens registrar-controlled official records

Transcript-only official records:

- rejected because it does not fit children's school progress, Bible school completion, competency, attendance, or graduation audit records

Separate official record posting and audit model:

- accepted because it preserves flexibility while protecting academic record integrity

Provider-controlled grade posting:

- rejected because Moodle or Canvas gradebooks are not the SIS official record source of truth

## Review Notes

- Product boundary: Academy owns official record entries, transcript rules, standing, promotion, graduation audit, and academic record audit history.
- LMS boundary: LMS grade return can inform evaluation results, but cannot directly create posted transcript or official record entries.
- Security/privacy: posted academic records require tenant isolation, release/hold controls, guardian relationship checks, and immutable audit history.
- Testing: implementation must cover submitted-vs-posted separation, transcript hold exclusion, superseding grade changes, guardian release denial, GPA/non-GPA standing, promotion, and graduation blockers.
- Rollback: this sprint changes docs only; future schema work must preserve audit integrity and use reversible migrations for non-audit tables.
