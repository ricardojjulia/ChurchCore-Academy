# Council Review V — Agent 3: UX & Shell Audit

_Date: 2026-06-18_

## 1. ARIA Correctness

**Pass on boolean attributes.** `aria-expanded`, `aria-current`, `aria-selected` all use boolean expressions correctly across all three shells. No string "true"/"false" violations.

**Gap — Admin search combobox is not ARIA-compliant.**
The search `<input>` (`admin-shell.tsx` ~line 293) lacks:
- `role="combobox"`
- `aria-haspopup="listbox"`
- `aria-controls` pointing to the listbox div
- `aria-activedescendant` tracking focused result

The listbox div and result items lack `id` attributes. Screen readers cannot announce the dropdown or navigate its options. There is also no keyboard arrow-down/up navigation between results — only mouse clicks work.

**Minor:** `student-pwa-nav` uses `aria-label="Student"` — too generic. Should be "Student portal navigation".

## 2. Loading and Empty States

**Present:** Root app, `/admin`, `/admin/admissions`, `/admin/programs`, `/admin/students`, `/admin/workflows`, `/faculty`, `/faculty/gradebook`, `/faculty/sections`, `/student`

**Missing loading.tsx (8 pages):**
- `/admin/transcripts`
- `/admin/staff`
- `/admin/courses`
- `/admin/sections`
- `/admin/gradebook`
- `/admin/settings/institution`
- `/admin/settings/calendar`
- `/admin/settings/people`

These pages show a blank white flash on slow connections. The shared `/app/admin/loading.tsx` only fires for the admin root.

**Empty states:** Solid on implemented pages. `StudentsPage` renders `.student-empty-state` CTA on empty data. Admissions renders a paragraph fallback. No crash-on-empty-array found.

## 3. CSS Completeness

**Undefined CSS custom properties (medium risk):**

| Missing token | Used in |
|---|---|
| `--primary` | `admin.css` (legacy block) |
| `--success`, `--warning`, `--danger` | `admin.css` (legacy block) |
| `--muted-foreground` | `admin.css`, `shared.css` |
| `--panel-border` | `admin.css` (legacy block) |
| `--background`, `--foreground` | `shared.css` |
| `--surface-gradient`, `--surface-soft-gradient` | `student-pwa.css` |
| `--radius-panel` | `student-pwa.css` |

These are legacy tokens from the old `academy-shell` era. Some have inline fallbacks; the legacy admin.css block does not. They render as transparent/initial if not inherited.

**Mobile responsiveness:** Well-handled. Admin shell breakpoints at 1080px and 720px; student PWA at 960px and 760px. Mobile hamburger toggle present in both admin and faculty shells.

**Print styles:** Present in both `admin.css` and `student-pwa.css` as of this review. Admin print hides sidebar, topbar, buttons; applies `@page { margin: 1.5cm }` and table formatting. Adequate for transcript printing.

## 4. Shell Nav Active State

All three shells use `usePathname()` with `startsWith` to derive active state — consistent approach.

**One inconsistency:** Admin sidebar `<aside>` receives class `is-open` based on `expanded !== null` (which section is expanded), not based on active route match. If a user collapses all sections manually, the sidebar shrinks to icon-only on desktop even when viewing an active page.

**Student PWA** uses exact `href === activeHref` equality with no `startsWith`. Future child routes like `/student/courses/123` would leave the nav item inactive.

## 5. Error Handling

Error boundaries present at all required levels:

| Level | File | Status |
|---|---|---|
| Root | `src/app/error.tsx` | Present (inline styles — minor issue) |
| Admin | `src/app/admin/error.tsx` | Present, uses `.ops-error-*` classes |
| Faculty | `src/app/faculty/error.tsx` | Present |
| Student | `src/app/student/error.tsx` | Present |
| Guardian | `src/app/guardian/error.tsx` | Present |

All boundaries log only `error.digest` (never `error.message`). No raw DB error messages exposed.

DB errors in server components are handled implicitly by the error boundary chain — no page returns raw Postgres errors to the client.

## 6. Top 3 UX Pain Points a Real User Would Hit Today

**1. Admin search is keyboard inaccessible.** Typing in the search input and pressing arrow-down does nothing. There is no focus management between results. Power users and screen reader users cannot use the student search at all without a mouse. This breaks the core "find a student → navigate to their record" workflow.

**2. Mobile sidebar stays open after navigation.** In both `AdminShell` and `FacultyShell`, `sidebarOpen` only toggles via the hamburger button. Nav link clicks do not call `setSidebarOpen(false)`. A phone user must manually close the sidebar after every navigation — it covers content until dismissed.

**3. 8 admin pages have no loading skeleton.** Transcripts, Staff, Courses, Sections, Gradebook, and all Settings sub-pages show a blank white screen on slow connections. The admin root skeleton fires only once; sub-pages receive no visual feedback during data fetching.
