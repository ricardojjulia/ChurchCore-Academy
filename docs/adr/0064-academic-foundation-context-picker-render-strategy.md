# ADR-0064 — Academic Foundation: Context Picker Render Strategy

**Date:** 2026-07-02
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** Academic Foundation design session 2026-07-02

---

## Context

The Academic Year + Period context picker must appear in every admin page and must reflect the
currently saved year and period for the authenticated user. It fetches data from two sources:
(1) the `academy_user_context` table for the saved selection, and (2) the list of available
academic years and their periods for the picker options.

The existing `admin-shell.tsx` already renders a period selector in the topbar using a client-side
`useEffect` that calls `/api/academy/calendar/periods` and reads/writes a browser cookie
(`academic_period_id`). That mechanism only covers periods within a single year and uses cookie
storage rather than the database. The new context picker must be database-persisted, cover both
year and period selection, and show the year name alongside the period name.

Three render strategies were considered:

1. **Server component with Suspense** — the shell server component fetches context, years, and
   periods at request time and passes them to the client picker as props.
2. **Client component with a single fetch hook** — the context picker is a client component that
   calls a single `/api/academy/user-context` GET on mount, receiving year, period, and options
   in one response.
3. **React context + hydration via layout** — a Next.js layout server component fetches context
   and injects it as a React context provider; the client picker consumes the context.

---

## Decision

**Strategy 1 — Server component with Suspense** is adopted.

The admin shell layout (`src/app/admin/layout.tsx` or the shell page layer) will:

1. Call `GET /api/academy/user-context` (or call the repository function directly through
   `withAcademyDatabaseContext`) at server render time.
2. Pass the resolved `{ activeYearId, activePeriodId, yearName, periodName, years, periods }` as
   props to the `AdminShell` component.
3. The `AdminShell` renders the context picker as a client sub-component (`AcademicContextPicker`)
   initialized with those server-fetched props as `defaultValue`.

### Why server-first

- **No layout shift.** The picker shows the correct year and period name immediately on first paint.
  A client-side fetch approach causes a blank picker followed by a hydration flash.
- **Cookie is eliminated.** The existing `academic_period_id` cookie approach is fragile across
  devices and sessions. Database persistence via `academy_user_context` is the authoritative source.
- **Auth is free.** The server component already has the authenticated actor from `requireActor()`,
  so no extra auth round-trip is needed to fetch context.
- **Suspense handles loading.** The layout wraps the shell in a `<Suspense>` boundary so slow DB
  reads do not block the entire page — only the shell placeholder is deferred.

### Tradeoffs accepted

- The shell server component cannot be statically cached (it is inherently dynamic). This is
  already the case for every admin page (`dynamic = "force-dynamic"`).
- When the user changes the year or period in the picker, the client component calls
  `PUT /api/academy/user-context`, then triggers `router.refresh()` which re-runs the server
  fetch with the new saved context. There is one network round-trip on change, which is acceptable.

### What changes in AdminShell

- `AdminShell` gains two new optional props: `academicContext` (resolved context from DB) and
  `academicContextOptions` (list of years with their periods, for the picker dropdown).
- The existing cookie-based period selector in the topbar is replaced by the new
  `AcademicContextPicker` client component.
- The cookie mechanism is removed entirely.

---

## Consequences

- Every admin page server component must pass context props into AdminShell, or the admin layout
  must inject them automatically. The layout approach is preferred to avoid repetition.
- The `academy_user_context` table must be created via migration before this feature ships.
- The `AcademicContextPicker` client component handles optimistic display: it updates its own
  local state immediately on change, then calls the API and triggers refresh.

---

## Alternatives Rejected

**Client component with fetch hook on mount:**
Causes blank picker flash on every page load. Requires an extra client-server round-trip per
navigation event. Rejected for UX quality reasons.

**React context + hydration via layout:**
Adds complexity (context provider boilerplate) without benefit over passing props from the server
layout. Rejected — simpler prop-passing is sufficient.

---

## Related

- ADR-0018 — Postgres RLS and request database context
- ADR-0017 — Session-derived Academy identity
- ADR-0025 — Page error boundary and loading state strategy
