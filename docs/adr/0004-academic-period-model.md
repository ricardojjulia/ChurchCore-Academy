# ADR 0004: Academic Period Model

Date: 2026-06-01
Status: accepted

## Context

ChurchCore Academy must support Bible schools, children's schools, seminaries, colleges, universities, and mixed institutions.

The platform cannot assume a college-only semester model. Different tenants may use school years, academic years, rolling enrollment, modules, intensives, trimesters, quarters, or year-round periods.

Academic periods will affect enrollment, registration, grading, transcript posting, completion records, student PWA schedules, LMS mapping, and ShepherdAI setup recommendations.

## Decision

ChurchCore Academy will model academic time with:

- `AcademicCalendarProfile`
- `AcademicYear`
- `AcademicPeriod`
- `EnrollmentWindow`
- `GradingWindow`
- `TranscriptPeriod`

`AcademicYear` is the top-level reporting or academic cycle. `AcademicPeriod` is a typed child record that can represent terms, sessions, modules, intensives, grading periods, reporting periods, or breaks.

Period behavior is determined by explicit fields and type-specific validation, not by assuming that every tenant has semesters.

## Consequences

This supports:

- rolling Bible school modules
- children's school trimesters and progress-report periods
- seminary intensives inside a semester
- college and university terms and sessions
- mixed institutions with separate calendars scoped to subdivision branches

The tradeoff is that implementation must validate parent-child period relationships carefully. Calendar setup UI also needs to guide users instead of exposing arbitrary date ranges without context.

## Alternatives Considered

College semester model:

- rejected because it cannot support children's schools, rolling Bible schools, or mixed institutions without exceptions

Fully custom date ranges:

- rejected because it is too vague for registrar workflows, transcript rules, LMS sync, and validation

Calendar system plus typed period hierarchy:

- accepted because it is flexible enough for faith-based institutions while still deterministic and testable

## Review Notes

- Product boundary: Academy owns academic periods as SIS system-of-record data.
- LMS boundary: LMS providers may consume period references later, but provider-specific calendar behavior remains outside this model.
- Security/privacy: period reads and writes must use the Academy tenant/admin policy from ADR 0003.
- Testing: future implementation must test school-year, academic-year, rolling-enrollment, module, semester, quarter, trimester, and mixed-institution cases.
- Rollback: this sprint changes docs only; future schema work must be reversible through migrations.
