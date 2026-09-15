# Council Review IV — Agent 3: UX & Shell Audit

_Date: 2026-06-18 | Read-only audit of ARIA, loading states, CSS, nav active state, and error handling._

---

## 1. ARIA Correctness

**Passing:** All `aria-expanded` and `aria-selected` usages pass JS booleans. Admin and faculty shells supply `aria-current="page"` on active nav links (added in Review III sprint). Student PWA shell uses `aria-current` consistently.

**Gap — `academy-shell.tsx`:** The legacy shell used at `/platform/control` computes `isActive` but applies only a CSS class — no `aria-current` attribute. Screen readers will not identify the current page in the platform control panel.

**ARIA violation — admin search dropdown:** `src/components/admin-shell.tsx:315–319` uses `<button role="option">` inside `role="listbox"`. The ARIA spec requires `role="option"` on non-interactive elements; combining it with a `<button>` creates two overlapping interactive roles. Screen readers may announce this as both a button and a listbox option simultaneously.

---

## 2. Loading and Empty States

**Root-level skeletons exist** at `src/app/admin/loading.tsx`, `src/app/faculty/loading.tsx`, `src/app/student/loading.tsx`. All referenced CSS classes are defined.

**Sub-route loading gap:** No `loading.tsx` exists at any sub-route level (`/admin/students`, `/admin/programs`, `/faculty/sections`, `/faculty/gradebook`, etc.). Users navigating between sub-pages see a blank shell while the server component fetches — no skeleton.

**Empty states:** Well-handled on admin pages. Student index, graduation, transcripts, attendance, faculty, and gradebook all have explicit zero-state messages.

**Transcript page (`/admin/transcripts`):** Shows a table of issued transcripts but provides no issuance action. Directs staff to POST to the API directly — a real gap for non-technical users.

---

## 3. CSS Completeness

All CSS classes referenced in components are defined. No dangling references.

**Mobile responsiveness:** Breakpoints at 640px, 720px, 768px, 960px, 1080px in `admin.css`; 640px, 760px, 960px in `student-pwa.css`. Mobile sidebar toggle added in Review III sprint.

**No print styles anywhere.** The transcript module declares `"print"` as a delivery method (`src/modules/transcripts/types.ts:2`) but there is zero `@media print` CSS. Browser-printing any page renders the full shell (sidebar, topbar, badges, buttons) on paper. No record page is print-safe.

---

## 4. Shell Nav Active State

| Shell | Strategy | Quality |
|---|---|---|
| `admin-shell.tsx` | `usePathname()` → `sectionForPath()` + optional `activeSection` prop | Solid; prop is optional, fallback works |
| `faculty-shell.tsx` | Same `usePathname()` + `sectionForPath()` | Consistent |
| `student-pwa-shell.tsx` | `activeHref` prop, prefix comparison | Consistent; all pages pass correct prop |
| `academy-shell.tsx` (legacy) | `activeHref` prop, exact string equality | Missing `aria-current`; no `usePathname` |

Admin pages `/admin/faculty`, `/admin/workflows`, `/admin/reporting` omit `activeSection`. `sectionForPath` resolves them correctly via pathname — no visible defect, but the pattern inconsistency could confuse future contributors.

---

## 5. Error Handling

**Error boundaries present and correct** at:
- `src/app/error.tsx` (root)
- `src/app/admin/error.tsx`
- `src/app/faculty/error.tsx`
- `src/app/student/error.tsx`
- `src/app/guardian/error.tsx`

All log only `error.digest`, never `error.message` — no internal leakage. `loadProtectedAcademyDataset` redirects cleanly on auth failure. DB errors propagate to the nearest `error.tsx` boundary (correct Next.js pattern).

**No sub-route `loading.tsx`** means `error.tsx` boundaries are the only safety net for sub-route failures; no intermediate feedback.

---

## 6. Top 3 UX Pain Points

1. **Transcript issuance is API-only.** Admin staff at a Bible school see a transcript list but cannot issue one from the UI. The page explicitly says "POST to `/api/academy/transcripts`" — unusable for non-technical staff.

2. **Sidebar nav requires two clicks to switch between sections.** Clicking an expanded section trigger collapses it. Clicking a different section then requires a second click. On the collapsed-icon sidebar, this also triggers the sidebar to collapse, making navigation non-obvious.

3. **No print/export for transcripts or records.** Browser print on `/admin/transcripts` or `/admin/reporting` renders full shell chrome on paper. No PDF download action exists anywhere in the SIS.
