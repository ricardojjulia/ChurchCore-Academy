# Council Review #1 — Synthesis
**Date:** 2026-09-20
**Review Number:** 1
**Triggered by:** First scheduled autonomous dev run for ChurchCore Academy

---

## Council Vote Tally

All 4 agents ran in parallel (read-only). No code was edited by any agent.

---

## Cross-Agent Consensus (Multi-agent agreement = highest priority)

### C1. No public applicant self-service portal (Agents 1, 2, 4)
All three agents independently flagged that while the `/apply` route tree exists and every page has a backing page.tsx, the applicant experience post-application is severely limited: no document upload from the applicant's own view, no conditional checklist visibility, no status tracking with real-time state, no enrollment agreement or digital signature. Agent 4 identifies this as the single largest workflow hole preventing school switching.

### C2. Student sub-routes have no loading skeletons (Agents 2, 3)
Agent 3 found all 10 student sub-routes (courses, progress, documents, messages, etc.) lack `loading.tsx`. Agent 2's route audit confirmed all 12 student nav destinations have pages, but Agent 3 shows they flash blank content on navigation. Combined: real users hit blank content states on every intra-student navigation.

### C3. No live payment processing (Agents 1, 4)
Agent 1 confirmed the billing module and ledger tables exist with full RLS. Agent 4 noted no student checkout UI and no self-pay flow. Every competitor allows students to pay online; this is a hard adoption blocker.

### C4. `scheduled-jobs` module is entirely untested (Agents 1, 3)
Agent 1 flagged it as the only module with zero `__tests__` directory. Agent 3's error-boundary scan implicitly confirmed it — a cron job evaluating academic standing has no guard. This is high-consequence: a silent miscalculation triggers or suppresses financial-aid holds.

---

## Individual Agent Findings

### Agent 1 — SIS State Audit
- 110 migration files, ~140 tables
- 36 core tables created without inline RLS (covered retroactively by `20260613010000` but risky if partial apply)
- `hq_*` tables (4 tables) have no module — all logic lives inline in a 1,238-line page component
- `scheduled-jobs` is the only module with no `__tests__`
- `ministry-formation` has no repository layer
- 16 redirect stub pages (harmless but URL consolidation incomplete)

### Agent 2 — Route & Page Audit
- All 48 nav hrefs across admin, faculty, and student shells resolve to existing pages — zero broken nav links
- No orphaned UI fetch calls found
- `/admin/settings/compliance` and `/admin/settings/courses` exist but are off-nav (reachable only via page body links from Reporting and Courses pages)
- `/admin/students/[id]` links to legacy `/workflows` instead of `/admin/workflows` — redirect handles it but stale link

### Agent 3 — UX & Shell Audit
- `TabsContent` unmounts inactive panels (returns `null`) — breaks ARIA `aria-controls` association; affects Calendar settings and Ministry Formation student detail pages
- ⌘K search shortcut badge renders in admin shell with no keyboard event listener wired
- All 10 student sub-routes missing `loading.tsx`; 8 admin sub-routes missing `loading.tsx`; 4 faculty sub-routes missing `loading.tsx`
- `error.tsx` missing for `/hq/`, `/apply/`, `/admissions/`, `/platform/`, `/internal/`
- Shell nav active-state logic consistent across admin/faculty/student; minor risk of prefix collision without trailing-slash guard in admin

### Agent 4 — Feature & Competitive Audit
- Overall roadmap: ~55% of phases complete, ~75% of MVP-critical phases
- MVP readiness score: **64 / 100** — full academic loop built and working; three gaps drag it: public admissions portal, student billing checkout, and controlled-pilot-only operating status
- Top competitive gaps vs Populi/Orbund/Jenzabar: (1) no public applicant portal, (2) no live payment, (3) no FAFSA/federal aid, (4) reporting self-disclaimed as unverified, (5) not cleared for official-record use at scale

---

## Implementation Prompts (Council-Recommended)

### Prompt G — Student Sub-Route Loading Skeletons

**ADR Reference:** None (UX consistency fix)
**Files:** Create `src/app/student/{courses,schedule,progress,documents,messages,lms,attendance,account,aid,privacy,formation}/loading.tsx` (10 files)
**Scope:** Each file renders a skeleton placeholder that matches the layout of its page — a few gray rounded bars matching the section structure. Use the same `<div className="animate-pulse ...">` pattern already in `src/app/student/loading.tsx`.

**Work:**
1. Read `src/app/student/loading.tsx` for the existing skeleton pattern
2. Create a `loading.tsx` in each of the 10 student sub-route directories with an appropriate skeleton
3. Verify no TypeScript errors: `npx tsc --noEmit`

**Security:** No auth concerns.
**Verification:** `npm run lint && npx tsc --noEmit`

---

### Prompt H — Fix TabsContent ARIA Pattern

**ADR Reference:** None (WCAG fix)
**Files:** `src/components/ui/tabs.tsx`
**Scope:** Inactive `TabsContent` panels currently `return null`, breaking `aria-controls` associations. Change to render with `hidden` attribute (or `aria-hidden="true"` + `tabIndex={-1}`) so the DOM element exists for AT to target.

**Work:**
1. Read `src/components/ui/tabs.tsx`
2. In `TabsContent`, replace `if (!selected) return null;` with rendering the panel element with `hidden` attribute when not selected (keep `role="tabpanel"`, add `tabIndex={selected ? 0 : -1}`, apply `className` with `hidden` when not selected)
3. Verify visual regression is zero (the panel is invisible but in DOM)
4. Verify `npm run lint && npx tsc --noEmit`

**Security:** No auth concerns.
**Verification:** `npm run lint && npx tsc --noEmit`

---

### Prompt I — Add Tests for `scheduled-jobs` Module

**ADR Reference:** None (test coverage)
**Files:** Create `src/modules/scheduled-jobs/__tests__/evaluate-academic-workflows.test.ts`
**Scope:** The `evaluate-academic-workflows.ts` cron job evaluates academic standing. Add: success case (student advances standing), no-op case (student already at correct standing), cross-tenant rejection test.

**Work:**
1. Read `src/modules/scheduled-jobs/evaluate-academic-workflows.ts`
2. Follow test conventions in `CLAUDE.md`: `node:test` + `node:assert/strict`, stub repository, no live DB
3. Cover: a run that updates standing, a run that finds no eligible students (no-op), a run that hits the tenant boundary guard (if any)
4. `npm run lint && npx tsc --noEmit`

**Security:** Verify no real tenant IDs or PII in test output (`doesNotMatch`).
**Verification:** `npm run lint && npx tsc --noEmit`

---

### Prompt J — Fix Stale `/workflows` Link in Student Detail Page

**ADR Reference:** None (link consistency)
**Files:** `src/app/admin/students/[id]/page.tsx` (or whichever file contains the `/workflows` href)
**Scope:** One inline `<a href="/workflows">` or `<Link href="/workflows">` points to the legacy redirect path instead of `/admin/workflows`. Change it to `/admin/workflows` directly.

**Work:**
1. `grep -rn 'href="/workflows"' src/app/admin/students/` to find the exact location
2. Replace with `href="/admin/workflows"`
3. `npm run lint && npx tsc --noEmit`

**Verification:** `npm run lint && npx tsc --noEmit`

---

## Execution Order

| Priority | Prompt | Effort | Risk |
|----------|--------|--------|------|
| 1 | J (stale link) | 5 min | zero |
| 2 | H (TabsContent ARIA) | 30 min | low |
| 3 | G (student loading skeletons) | 60 min | low |
| 4 | I (scheduled-jobs tests) | 2–3 hours | medium |
| 5 | B–F (remaining ADR-0048 API routes) | 1–2 days | low |

G, H, J are independent and can be done in any order.
I requires reading the scheduled-jobs module first to understand its boundaries.
B–F are already in `IMPLEMENT.md` in dependency order.

---

## MVP Readiness Path

The council scores the project at **64/100**. To reach 80+:
1. Ship Prompts B–F (complete ADR-0048 document API) — enables full applicant document upload flow
2. Ship Prompt G (loading skeletons) — removes blank-flash UX regression for student users
3. Fix Tab ARIA (Prompt H) and stale link (Prompt J) — low-effort quality wins
4. Ship `scheduled-jobs` tests (Prompt I) — closes the single highest-risk untested code path
5. Activate student billing checkout (out of scope for this sprint; requires separate council approval)
