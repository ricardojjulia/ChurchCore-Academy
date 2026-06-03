# ADR 0001: Use One-Week Factory Sprints

Date: 2026-06-01
Status: accepted

## Context

ChurchCore Academy is moving from product foundation into implementation. The platform spans institution configuration, academic calendars, courses, grading, people and roles, student PWA, LMS integrations, and ShepherdAI Academy.

The project needs short review cycles so product direction can be corrected before large amounts of code accumulate.

## Decision

ChurchCore Academy will use one-week software-factory sprints.

Each sprint must produce one reviewable artifact, such as a design package, ADR, domain model, migration, repository, UI surface, provider-contract slice, test suite, or verified documentation update.

## Consequences

This keeps work small, reviewable, and easier to redirect. It also forces larger subplans to be split into execution packages before implementation.

The tradeoff is that some phases require multiple sprints before users see a full workflow. That is acceptable because the domain model needs to be stable before building broad UI and LMS integration layers.

## Alternatives Considered

Two-week sprints:

- Rejected because the user prefers faster iteration and review.
- Useful later when implementation becomes more predictable.

Parallel tracks:

- Rejected for the initial phase because institution configuration, calendar, course, grading, people, and LMS boundaries are not stable enough to safely parallelize.

## Review Notes

- Product boundary: reinforces factory gates and prevents broad uncontrolled changes.
- Security/privacy: gives high-risk student, guardian, grade, transcript, and LMS work a weekly review point.
- Testing: every sprint must identify exact verification commands.
- Rollback: sprint artifacts are small enough to defer, revise, split, or revert without losing an entire phase.
