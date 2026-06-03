# ADR 0006: Course Duration And Credit Clock-Hour Model

Date: 2026-06-02
Status: accepted

## Context

ChurchCore Academy must support Bible schools, children's schools, seminaries, colleges, universities, and mixed institutions.

Courses cannot assume college-only credit hours. A Bible school may use clock hours, modules, competencies, or completion records. A children's school may use instructional days, weeks, grade-level classes, narrative evaluation, and progress reports. Seminaries, colleges, and universities often need credits, labs, practica, internships, and transcripts.

Course duration and record rules will affect section setup, enrollment, grading, transcripts, student PWA schedules, LMS shell mapping, and ShepherdAI setup recommendations.

## Decision

ChurchCore Academy will model course size and record behavior separately from the course identity.

Catalog courses will have:

- `recordType`
- `defaultDuration`
- optional `defaultCredits`
- optional `defaultClockHours`
- optional competency references

Course duration may use these units:

- `credit_hour`
- `clock_hour`
- `instructional_day`
- `week`
- `module`
- `semester`
- `trimester`
- `quarter`
- `custom`

Validation, not the base type alone, determines which fields are required for a given institution mode and record type.

## Consequences

This supports:

- Bible school modules and ministry practica that use clock hours or completion records
- children's school classes that use instructional days, weeks, progress reports, or narrative records
- seminary intensives and credit-bearing graduate courses
- college and university courses with credits, labs, internships, and transcript records
- mixed institutions that run different course rules under one tenant

The tradeoff is that validation must be mode-aware. The UI must guide admins so flexible duration fields do not become ambiguous data.

## Alternatives Considered

Credit-only course model:

- rejected because it cannot model children's school classes, Bible school clock-hour certificates, or non-transcript learning records cleanly

Fully generic duration text:

- rejected because it is too vague for grading, transcript, LMS, PWA, and validation logic

Separate typed duration model with validation:

- accepted because it preserves flexibility while keeping deterministic setup checks

## Review Notes

- Product boundary: Academy owns course duration and record behavior as SIS system-of-record configuration.
- LMS boundary: LMS providers may consume course duration metadata later, but provider runtime behavior does not determine the Academy course model.
- Security/privacy: future writes must be tenant-scoped and audited when duration changes can affect transcripts, completion records, billing, or student schedules.
- Testing: implementation must test Bible course, children's class, seminary intensive, college credit course, university lab, practicum, and mixed-institution cases.
- Rollback: this sprint changes docs only; future schema work must be reversible through migrations.
