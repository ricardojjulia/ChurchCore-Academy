# ADR-0025 — Page Error Boundary and Loading State Strategy

**Date:** 2026-06-18
**Status:** Accepted
**Authors:** Council Review III (Agents 1–4 consensus)

---

## Context

The Council III audit found that no `error.tsx` files exist at any layout level (`/app`, `/app/admin`, `/app/student`, `/app/faculty`, `/app/guardian`). Server component data-fetching errors (auth failures, DB connection errors, RLS violations) propagate directly to the Next.js default error page — a gray, unbranded experience with no recovery path.

Additionally, there are no loading skeletons on any page. Heavy pages (`/admin/gradebook`, `/admin/reporting`, `/admin/students`) fetch multiple parallel queries; users see a blank page for 1–2 seconds before any content appears. Student PWA pages silently collapse when arrays are empty, giving no feedback.

These are not cosmetic issues. An auth failure during a student record view or a DB timeout during grade entry produces an unrecoverable state with no guidance.

---

## Decision

**Every layout level that owns protected routes must have a co-located `error.tsx`.** Required locations:

- `src/app/error.tsx` — root fallback
- `src/app/admin/error.tsx` — admin portal
- `src/app/faculty/error.tsx` — faculty portal
- `src/app/student/error.tsx` — student PWA
- `src/app/guardian/error.tsx` — guardian portal

Each `error.tsx` must be a `"use client"` component that:
1. Renders a branded, role-appropriate error message
2. Offers a "Go back" or "Return to dashboard" link
3. Does not expose raw error messages, stack traces, or DB error text to the user
4. Logs the sanitized error for observability

**Empty states** must be handled at the component level:
- Any page that renders a list or table must check for empty arrays and render a styled empty-state component
- Empty states must include a next-action prompt (e.g., "No students enrolled yet — start with Admissions")
- Silence (rendering nothing) is never acceptable

**Loading states** in Next.js App Router are handled via `loading.tsx` co-located with pages:
- `src/app/admin/loading.tsx` — admin spinner/skeleton
- `src/app/student/loading.tsx` — student PWA skeleton
- `src/app/faculty/loading.tsx` — faculty portal skeleton

Loading files should render a skeleton that matches the page's layout (not a generic spinner), to avoid layout shift.

---

## Consequences

**Positive:**
- Users get branded, recoverable error experiences instead of Next.js gray screens
- Auth failures are caught and redirect gracefully rather than exposing framework internals
- Empty states communicate product intent even before data is loaded (important during demos and early adoption)
- Loading skeletons reduce perceived latency and prevent layout shift

**Negative:**
- Three new files per protected layout area (error.tsx, loading.tsx, empty state component)
- Error boundaries are `"use client"` and cannot access server-side session context; error messages must be generic

---

## Scope Boundaries

- `error.tsx` must never show raw Postgres error messages, Supabase error codes, or stack traces
- `loading.tsx` must not import business logic or make data fetches
- Empty-state copy must be product-specific, not generic ("No students" not "No records found")
- This ADR does not cover API route error handling — that is already handled by the pattern established in academy-auth

---

## Related ADRs

- ADR-0017: Session-derived Academy identity (auth failure paths)
- ADR-0018: Postgres RLS and request database context (DB failure paths)
