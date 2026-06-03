# ADR 0010: Evaluation Type And Grading Rule Model

Date: 2026-06-02
Status: accepted

## Context

ChurchCore Academy must support grading and evaluation across Bible schools, children's schools, seminaries, colleges, universities, and mixed institutions.

These institutions do not share one grading model. Some need letter grades and GPA. Others need pass/fail completion, clock-hour certificates, competency checklists, attendance-only records, or narrative progress. A college-only grade table would force children's school and Bible school records into awkward exceptions. A fully generic JSON evaluation model would make GPA, transcript, promotion, standing, and graduation calculations hard to validate and audit.

## Decision

ChurchCore Academy will model course and section evaluation through typed evaluation rules.

The grading domain will use:

- `GradingProfile` for tenant-level grading posture
- `EvaluationScale` for reusable grade, completion, competency, narrative, attendance, or custom scales
- `EvaluationScaleBand` for deterministic mapping from raw values to labels, grade points, pass/completion flags, and official record values
- `EvaluationRuleSet` for course-level defaults or section-level overrides
- `EvaluationResult` for student-specific draft, submitted, imported, or approved outcomes

Evaluation type is explicit. GPA, credit, clock-hour, competency, narrative, attendance, completion, and LMS grade-return behavior are policy fields, not implicit assumptions.

## Consequences

This supports:

- GPA-bearing college, seminary, and university courses
- non-GPA children's school progress records
- Bible school completion and clock-hour records
- pass/fail, competency, narrative, attendance-only, and custom evaluation
- deterministic validation before persistence and UI work
- future LMS grade return without making an LMS gradebook authoritative

The tradeoff is a larger model than a flat grade table. Admin UI must clearly distinguish scale, rule set, evaluation result, and official record posting.

## Alternatives Considered

College-only letter-grade model:

- rejected because it is too narrow for children's school, Bible school, completion, competency, narrative, and attendance-only records

Generic JSON evaluation blob:

- rejected because it weakens validation, audit, GPA calculation, transcript posting, promotion, and graduation rules

Evaluation type plus rule set:

- accepted because it supports institution-mode differences while preserving deterministic validation

LMS gradebook as source of truth:

- rejected because it breaks no-LMS mode, couples official records to provider behavior, and weakens registrar control

## Review Notes

- Product boundary: Academy owns evaluation policy and academic record outcomes as SIS system-of-record data.
- LMS boundary: Moodle, Canvas, and external providers may submit normalized grade-return payloads later, but provider gradebooks do not directly post official records.
- Security/privacy: future writes must be tenant-scoped, role-scoped, and audited, with no provider credentials stored in grading records.
- Testing: implementation must cover GPA, pass/fail, completion, competency, narrative, attendance-only, grade-band overlap, non-GPA exclusion, and cross-tenant reference denial.
- Rollback: this sprint changes docs only; future schema work must be reversible through migrations.
