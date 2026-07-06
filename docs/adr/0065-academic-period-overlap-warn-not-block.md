# ADR-0065 — Academic Period Date Overlap: Warn, Do Not Hard-Block

**Date:** 2026-07-02
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** Academic Foundation design session 2026-07-02

---

## Context

When an admin creates or edits an Academic Period (Term/Session) within an Academic Year, the
proposed start/end dates may overlap with another existing period in the same year. For example,
a "Fall 2026" semester (Aug 28 – Dec 18) and a "Fall Intensive" module (Oct 1 – Oct 14) would
overlap. The question is whether the system should hard-reject the overlap (return an error and
refuse to save) or warn the admin and allow them to proceed.

---

## Decision

**Overlapping dates within the same Academic Year produce a warning, not a hard-block.**

The API and module layer:
- Check for overlapping periods within the same Academic Year (same `tenant_id`, same
  `academic_year_id`, excluding the period being edited).
- If an overlap is detected, return HTTP 200 with the saved period **plus** a `warnings` array
  containing `{ code: "DATE_OVERLAP", overlappingPeriodIds: string[], message: string }`.
- The period is saved. The warning is informational.

The UI:
- Displays a non-blocking yellow warning banner: "This period's dates overlap with [Period Name].
  Overlapping periods are allowed — verify this is intentional."
- Does not prevent the save.
- Does not prevent status transitions on the overlapping period.

### Why warn and not block

**Faith-based institutions routinely overlap periods by design.** Examples:

- A semester contains a midterm exam "grading period" (a sub-period) that overlaps in time with
  the parent semester — but the `parent_period_id` model already handles hierarchical nesting.
- A "Bible Intensive" module runs for two weeks inside a semester, with independent enrollment.
- A K-12 school may run a "Mini-Course Week" inside the fall semester that is tracked separately.
- A seminary runs a "January Term" that overlaps the spring semester start by a few days.

Blocking overlaps would prevent valid configurations used by the institution types this product
must support. The admin is the domain expert — the system warns but defers to the human.

**Hard-blocking was already rejected in ADR-0050** for academic calendar admin CRUD; this ADR
formalizes the rule specifically for the overlap case.

### Boundary condition: hard blocks that remain

These conditions remain hard rejections (400 error, no save):

- A period that starts before its parent Academic Year's `starts_on`.
- A period that ends after its parent Academic Year's `ends_on`.
- A period whose `starts_on >= ends_on`.
- Duplicate `code` within the same Academic Year.
- Duplicate `sequence` value within the same Academic Year.

These are structural invariants, not scheduling choices.

---

## Consequences

- The module overlap check runs in `createTerm` and `updateTerm` (and their period equivalents)
  in `src/modules/academic-calendar/mutations.ts`, returning a structured warning rather than an
  error.
- The API routes for period creation and update return `{ period, warnings: [] }` rather than
  just `{ period }` — callers must be updated to handle the `warnings` array.
- The UI must display warnings without blocking the success path.

---

## Alternatives Rejected

**Hard-block overlapping dates:**
Rejected. Breaks valid configurations for seminaries, Bible schools, and K-12 institutions that
intentionally schedule overlapping periods (intensive modules, sub-terms, exam periods).

**Silently allow overlaps with no warning:**
Rejected. An admin who accidentally enters wrong dates deserves a signal. The warning surfaces
the issue without preventing intentional configurations.

---

## Related

- ADR-0050 — Academic calendar admin CRUD with term-lock policy
- ADR-0004 — Academic period model
