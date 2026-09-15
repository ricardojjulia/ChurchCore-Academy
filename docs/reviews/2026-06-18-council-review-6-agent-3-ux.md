# Council Review VI — Agent 3: UX & Shell Audit

_Date: 2026-06-18_

## 1. ARIA Correctness

**Improved from Council V. New gaps found.**

Admin search combobox: `role="combobox"`, `aria-haspopup`, `aria-expanded` (boolean), `aria-controls`, `aria-activedescendant` — all present and correct (Council V Prompt B implemented).

**New gap — Mobile menu toggle:** `aria-expanded={sidebarOpen}` and `aria-label` are correct, but there is no `aria-controls` pointing to the sidebar `<aside>`, and the `<aside>` has no `id`. Screen readers cannot programmatically associate the toggle with what it controls.

**New gap — Tabs component** (`src/components/ui/tabs.tsx`): Uses `role="tab"`, `role="tablist"`, `role="tabpanel"` correctly. Missing: `TabsTrigger` has no `id` and no `aria-controls` pointing to its panel. `TabsContent` (`role="tabpanel"`) has no `aria-labelledby` back to the trigger. This breaks the ARIA tab pattern — keyboard users cannot jump between trigger and panel using standard AT shortcuts.

Nav links: `aria-current={itemActive ? "page" : undefined}` correct across all three shells.

## 2. Loading and Empty States

Loading skeleton coverage is now strong but 3 pages remain uncovered:
- `/admin/graduation` — no `loading.tsx`
- `/admin/reporting` — no `loading.tsx`
- `/admin/faculty` — no `loading.tsx`

These show blank white on slow connections. The layout-level `/app/admin/loading.tsx` only fires for the admin root.

Empty states: all implemented pages handle empty arrays without crashing.

## 3. CSS Completeness

All tokens in `tokens.css` are now defined and used consistently (Council V Prompt D implemented). No undefined custom property references found.

**New gap — Responsive grid:**
- `admin-dashboard-grid` (two-column layout) has no breakpoint in the `@media (max-width: 1080px)` block. On tablet/mobile it overflows horizontally.
- `admin-quick-actions` (two-column) similarly has no responsive collapse.

All other multi-column grid classes (`ops-stats-grid`, `ops-content-grid`) correctly collapse to single-column at ≤1080px. This is an inconsistency — two grids were missed.

Mobile overlay, print styles, and loading skeleton CSS all defined and complete.

## 4. Shell Nav Active State

Consistent `usePathname()` + `startsWith` across admin and faculty shells. Student PWA uses a caller-supplied `activeHref` prop rather than `usePathname()` — this works if callers pass the correct value, but creates a silent failure mode for any page that omits or misstates it. No crash, just a dead-looking nav.

## 5. Error Handling

Error boundaries at all required levels: root, admin, faculty, student, guardian. All log only `error.digest`. No raw DB errors exposed to client.

## 6. Top 3 UX Pain Points Today

**1. Admin sidebar icon-only mode has no labels on hover.** First-time admin users see 7 unlabeled icons on a collapsed sidebar. There is no tooltip, no hover label, and no onboarding hint. Users must click an icon to discover its label. This is a severe first-use friction point.

**2. Student PWA `activeHref` is prop-driven, not URL-derived.** Every student page must pass the exact nav href as a prop. If omitted or incorrect, no nav item appears active — a silent failure. Replacing with `usePathname()` eliminates this class of bug entirely.

**3. Tabs component is keyboard-inaccessible for screen readers.** Used across student record views and settings panels. Missing `aria-controls`/`aria-labelledby` means AT users cannot navigate between tab trigger and panel. This is a functional accessibility failure.
