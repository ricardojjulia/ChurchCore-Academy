# Council Review II — Agent 3: UX / Shell Audit
**Date:** 2026-06-17 | **Scope:** All shell components, nav states, ARIA, CSS, dead pages

---

## Critical Bugs

### 1. `/faculty/shepherd` — 404 on Dashboard Click
**File:** `src/app/faculty/page.tsx`
**Severity:** CRITICAL
**Description:** Faculty dashboard renders an `<a href="/faculty/shepherd">` quick-action card that 404s. The page does not exist. Any faculty member clicking "ShepherdAI Signals" lands on Next.js 404.
**Fix:** Create `/faculty/shepherd` page (Prompt G) or replace the link with a disabled state until the page exists.

---

## HIGH Severity

### 2. `/admin/faculty` Not in Admin Sidebar
**File:** `src/components/admin-shell.tsx`
**Severity:** HIGH
**Description:** `/admin/faculty` is a real, data-backed page showing faculty assignment imbalances. It is only reachable via the admin dashboard quick-action card. It is not listed in `NAV_SECTIONS` in the sidebar. Users on any sub-page have no nav path back to faculty.
**Fix:** Add Faculty entry to the "Daily Ops" section in `NAV_SECTIONS` (Prompt G).

### 3. `/admin/staff` Does Not Exist
**File:** None
**Severity:** HIGH
**Description:** There is no `/admin/staff` page. Staff are invited via `/admin/settings/people` (StaffInviteForm), but there is no directory view showing all staff records with their roles, contact info, and employment status. The `academy_staff_profiles` and `academy_people` tables have the data.
**Fix:** Create `/admin/staff` page backed by real data (Prompt H).

### 4. `/admin/reporting` Does Not Exist
**File:** None
**Severity:** HIGH
**Description:** No reporting or analytics page exists. The admin dashboard has summary cards, but there is no drill-down reporting surface. ShepherdAI signals produce urgency data but no aggregate view.
**Fix:** Build `/admin/reporting` with enrollment counts, grade distribution, at-risk students, section fill rates (Prompt J).

---

## MEDIUM Severity

### 5. Faculty Nav Items Have No `title` Tooltips
**File:** `src/components/faculty-shell.tsx`
**Severity:** MEDIUM
**Description:** Faculty sidebar nav leaf items use `<a>` tags without `title` attributes. When the sidebar is collapsed (narrow viewport), only the icon is visible and there is no tooltip to identify the destination. Admin shell has the same gap but is less critical since admins are desktop-first.
**Fix:** Add `title={item.label}` to `<a>` tags in FACULTY_NAV rendering (Prompt G).

### 6. Student Messages — No Thread UI, Empty State Only
**File:** `src/app/student/messages/page.tsx`
**Severity:** MEDIUM
**Description:** Messages page renders an honest empty state with a "No messages" callout. This is correct for now (no messaging backend), but the nav tab creates a user expectation. The shell prominently shows a Messages nav item.
**Status:** Acceptable empty state per architecture — messaging is out of scope for the current phase. Not blocking.

### 7. Student PWA LMS Page — No Active LMS Link
**File:** `src/app/student/lms/page.tsx`
**Severity:** MEDIUM
**Description:** LMS launch panel exists but shows a placeholder launch URL if no LMS provider is configured. When `lmsLaunchUrl` is null, the button is disabled but the empty state copy does not explain what "connected learning system" means. Could confuse students.
**Status:** Architecture-correct — LMS connection is an institutional setup step, not a student-facing bug.

### 8. Admin Settings People Page — No Staff Directory Link
**File:** `src/app/admin/settings/people/page.tsx`
**Severity:** MEDIUM
**Description:** The People settings page has a StaffInviteForm and role coverage summary, but no link to a staff directory. After inviting a staff member, there is no way to view the new record without navigating away.
**Fix:** Add "View all staff →" link to `/admin/staff` once that page exists (Prompt H).

---

## LOW Severity / Observations

### 9. Admin Gradebook — `loadGradedCounts()` is an Inline Pool Query
**File:** `src/app/admin/gradebook/page.tsx`
**Severity:** LOW
**Description:** The gradebook page defines `loadGradedCounts()` inline within the page module rather than in a module repository. This is a convenience shortcut — acceptable for now but should migrate to `src/modules/gradebook/repository.ts` if it grows.
**Status:** Acceptable for current phase. Note for future refactor.

### 10. Tabs Without Keyboard Focus Indicator
**File:** Multiple admin tab components
**Severity:** LOW
**Description:** The `<Tabs>` from shadcn/ui have default focus rings but some pages customize them via CSS in `admin.css` in ways that may reduce visibility. Not blocking — the component library handles focus by default.

### 11. AriaExpanded Attribute Was String, Now Boolean
**File:** `src/components/faculty-shell.tsx`
**Severity:** LOW (Fixed)
**Description:** Previously `aria-expanded={isExpanded ? "true" : "false"}` (invalid — must be boolean). Fixed in Prompt C: `aria-expanded={isExpanded}`.
**Status:** Fixed.

---

## Shell Inventory

### admin-shell.tsx
- **Nav sections:** 5 (Admissions, Records, Academics, Daily Ops, System)
- **Items per section:** 3–3–3–3–3
- **Aria:** `aria-label="Main navigation"` present ✅
- **Mobile:** Sidebar collapses to icon-only on mobile, no tooltip fallback ⚠️
- **Active state:** `pathname.startsWith(item.href)` — correct for nested routes ✅

### faculty-shell.tsx
- **Nav sections:** 4 (Today, Teaching, Grading, Students)
- **Items per section:** 2–2–1–1
- **Aria:** `aria-expanded` now boolean ✅, `aria-label` present ✅
- **Mobile:** Same icon-only collapse, missing tooltips ⚠️
- **Active state:** Exact match (`pathname === item.href`) — does NOT highlight active parent when on nested route ⚠️

### student-pwa shell (inlined in layout.tsx)
- **Nav items:** 8 (Home, My Courses, Schedule, Progress, Documents, Messages, Learning, Privacy)
- **Aria:** Not audited in depth, component library handles defaults
- **Mobile:** Bottom tab bar pattern — correct for PWA ✅

---

## CSS Observations

### `src/styles/admin.css`
- `.ops-form`, `.ops-form-row`, `.ops-field`, `.ops-input` — new form layout classes ✅
- `.ops-alert`, `.ops-alert-success`, `.ops-alert-error` — feedback banner classes ✅
- `color-mix()` browser compatibility: most banner backgrounds use `color-mix()` already present in file. New form alert borders use plain hex `#86efac` / `#fca5a5` to avoid warnings. ✅
- `.student-pwa-empty` class used in messages page — present in `student.css` ✅

---

## Summary Table

| # | Issue | Severity | Prompt |
|---|-------|----------|--------|
| 1 | `/faculty/shepherd` 404 | CRITICAL | G |
| 2 | `/admin/faculty` not in sidebar | HIGH | G |
| 3 | `/admin/staff` missing | HIGH | H |
| 4 | `/admin/reporting` missing | HIGH | J |
| 5 | Faculty nav items missing `title` | MEDIUM | G |
| 6 | Messages empty state | MEDIUM | Acceptable |
| 7 | LMS placeholder copy | MEDIUM | Acceptable |
| 8 | No staff directory link | MEDIUM | H |
| 9 | Inline pool query in gradebook page | LOW | Future |
| 10 | Tab keyboard focus | LOW | Out of scope |
| 11 | `aria-expanded` string vs boolean | LOW | Fixed (Prompt C) |
