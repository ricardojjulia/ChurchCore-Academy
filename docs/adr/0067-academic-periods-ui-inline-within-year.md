# ADR-0067 — Academic Periods UI: Inline Within Year Detail, Not Separate Period Pages

**Date:** 2026-07-02
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** Academic Foundation design session 2026-07-02

---

## Context

Academic Periods (Terms/Sessions) are children of an Academic Year. The admin needs to:
- See all periods for a year at a glance
- Create new periods within a year
- Edit a period's name, type, dates, and sequence
- Archive a period

Two patterns were considered for where this UI should live:

**Option A: Inline within the Academic Year detail** — When an admin clicks on an Academic Year
(or expands a year row), a sub-section or tab within the year view shows its periods with inline
create/edit/archive. No separate route per period.

**Option B: Each period has its own detail page** — Periods are listed in the year view with
"Open" links that navigate to `/admin/settings/calendar/years/[yearId]/periods/[periodId]`.

---

## Decision

**Option A: Periods are managed inline within the Academic Year settings view.**

The Academic Year detail view at `/admin/settings/calendar/years/[id]` (a new page created for
this foundation sprint) will show:
- The year's metadata (name, code, dates, status, calendar system) at the top, editable in place.
- A "Periods" section below the year header — a table or card list of all periods belonging to
  this year, with inline create, edit, and archive actions.
- "Add Period" button opens a modal drawer (same Dialog pattern as existing CreateYearButton).
- Each period row has a dropdown action menu (same DropdownMenu pattern as existing PeriodActions).

### Why inline, not separate pages

**1. Periods have low information density.** A period record has six editable fields (name, type,
start date, end date, sequence, status). A separate detail page for six fields adds navigation
overhead with no benefit. Compare: a Student record justifiably has its own page because it has
dozens of sub-sections (academic record, ShepherdAI signals, relationships, sections). A Period
does not.

**2. Admin workflow is year-centric.** Registrars think in years: "I'm setting up Fall 2026-2027.
What periods does it have?" They open a year and configure its periods without navigating away.
Requiring them to navigate back and forth between a year page and individual period pages breaks
this mental model.

**3. Consistent with existing calendar page pattern.** The existing `/admin/settings/calendar`
page already lists periods in a flat table grouped by year. The new year detail page is a focused
version of the same concept — just scoped to one year.

**4. Period actions are already modal-based.** `PeriodActions.tsx` already uses AlertDialog for
state transitions. Extending this with an edit dialog follows the same component pattern without
introducing a new page routing pattern.

### Navigation path

- `/admin/settings/calendar` — list of all academic years (existing page, updated)
- `/admin/settings/calendar/years/[id]` — year detail with inline period management (new page)
- Clicking a year name in the calendar list navigates to its detail page.

---

## Consequences

- A new page `src/app/admin/settings/calendar/years/[id]/page.tsx` is created.
- The existing `CalendarClient.tsx` is updated to link year names to their detail pages.
- Period create/edit/archive remain modal-based — no new period-specific routes needed.
- The existing `/api/academy/calendar/periods/[id]` API route is reused for period CRUD.

---

## Alternatives Rejected

**Option B: Separate period detail pages:**
Rejected. Periods are simple records — a dedicated page adds navigation overhead and routing
complexity without any additional content to display at the period level. If periods grow in
complexity (enrollment windows, grading windows) those can be added as tabs within the year
detail without creating separate period pages.

---

## Related

- ADR-0050 — Academic calendar admin CRUD with term-lock policy
- ADR-0025 — Page error boundary and loading state strategy
