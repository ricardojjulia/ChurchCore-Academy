# Council Review VI — Synthesis

_Date: 2026-06-18_  
_Agents: SIS State, Routes, UX/Shell, Competitive_  
_Prior: Council V (2026-06-18)_

## Cross-Agent Consensus

### Critical (blocking MVP)

| Finding | Agents | ADR |
|---|---|---|
| UUID/text type mismatch — attendance and transcript FK columns | A1 + A3 seed impact | ADR-0032 (new) |
| 33 pages still on `loadProtectedAcademyDataset` — second tenant sees broken pages | A1 + A2 confirmed | ADR-0030 Phase A |

### High (functional gaps within current scope)

| Finding | Agents | Notes |
|---|---|---|
| Mobile menu toggle missing `aria-controls` → sidebar `id` | A3 | Small ARIA fix |
| Tabs component missing `aria-controls`/`aria-labelledby` | A3 | Used widely across student records + settings |
| 3 admin pages missing `loading.tsx` — graduation, reporting, faculty | A3 | Pattern inconsistency |
| `admin-dashboard-grid` and `admin-quick-actions` not responsive | A3 | 2 grid classes without breakpoint |
| Faculty `/students` nav link stubs to admin shell | A2 | Shell context dropped |
| 3 orphan settings pages not in admin nav | A2 | Courses, grading, demo-feedback |

### Deferred (factory sprint scope)

| Finding | Agents | Sprint |
|---|---|---|
| Course catalog and calendar management API (no CRUD) | A1 | Phase 3 sprint |
| Graduation audit module | A1 + A4 | Phase 5 sprint |
| Gradebook assignment management endpoints | A1 | Phase 5 sprint |
| Transcript issuance write workflow | A1 + A4 | Phase 5 sprint |
| Student billing and payments | A4 | Phase 12 sprint |
| Admissions self-service portal | A4 | Phase 11 sprint |
| ATS/IPEDS compliance reporting | A4 | Phase 14 sprint |

## What Improved Since Council V

- Search combobox ARIA (combobox + listbox roles, `aria-activedescendant`, keyboard nav) — done
- Nav link `onClick` sidebar close — done (admin + faculty)
- 8 `loading.tsx` files — done
- CSS tokens complete — done
- Print styles — done
- ShepherdAI pages moved to DB reads (ADR-0031) + ReEvaluateButton — done
- Guardian `naomi-price` seed data — done

## Prompt Plan

### Prompt A — UUID/text schema fix _(sequential first; unblocks B's seed step)_

Write two migrations:
- `20260619010000_fix_attendance_uuid_columns.sql`: Alter `academy_attendance_records.course_section_id` and `student_person_id` from `uuid` to `text`. Add FK constraints referencing `academy_course_sections(id)` and `academy_people(id)`.
- `20260619020000_fix_transcript_issuances_uuid_columns.sql`: Alter `academy_transcript_issuances.student_person_id` and `issued_by_person_id` from `uuid` to `text`. Add FK constraints referencing `academy_people(id)`.

Then update `20260618030000_seed_demo_extended.sql` to add the blocked seed rows: at minimum 3 `academy_attendance_records` and 1 `academy_transcript_issuances` row for Naomi Price. Remove the blocker comment.

ADR reference: ADR-0032.

---

### Prompt B — 3 missing loading.tsx _(parallel with C, D, E, F)_

Create:
- `src/app/admin/graduation/loading.tsx` — stat cards (2) + table skeleton
- `src/app/admin/reporting/loading.tsx` — table skeleton
- `src/app/admin/faculty/loading.tsx` — table skeleton

Match the exact pattern in `src/app/admin/transcripts/loading.tsx`.

---

### Prompt C — Faculty `/students` nav fix _(parallel)_

In `src/components/faculty-shell.tsx`: Remove the "All Students" nav link entry that points to `/students`. Faculty users should use `/faculty/roster` to view students in their sections. There is no faculty-scoped all-students page and sending faculty into the admin shell is a regression.

Also: delete `src/app/students/page.tsx` (the stub redirect) if it was created only to serve this nav link and has no other references.

---

### Prompt D — Sidebar `aria-controls` + Tabs ARIA _(parallel)_

**Sidebar:**
In `src/components/admin-shell.tsx` and `src/components/faculty-shell.tsx`:
- Add `id="sidebar-nav"` to the `<aside>` element.
- Add `aria-controls="sidebar-nav"` to the mobile menu toggle `<button>`.

**Tabs component:**
In `src/components/ui/tabs.tsx`:
- `TabsTrigger`: Add `id={`tab-${value}`}` and `aria-controls={`tabpanel-${value}`}`.
- `TabsContent`: Add `id={`tabpanel-${value}`}` and `aria-labelledby={`tab-${value}`}`.
- The `value` prop is already present on both — derive the IDs from it.

---

### Prompt E — Dashboard grid responsive CSS _(parallel)_

In `src/styles/admin.css`, inside the existing `@media (max-width: 1080px)` block:
Add:
```css
.admin-dashboard-grid {
  grid-template-columns: 1fr;
}
.admin-quick-actions {
  grid-template-columns: 1fr;
}
```

This matches the existing pattern already applied to `ops-stats-grid` and `ops-content-grid`.

---

### Prompt F — Student PWA `activeHref` → `usePathname()` _(parallel)_

In `src/components/student-nav.tsx` (or equivalent student PWA nav component):
- Remove the `activeHref` prop.
- Import `usePathname` from `next/navigation`.
- Derive `isActive` using `usePathname()` with `startsWith` — same pattern as the admin and faculty shells.

Update all call sites that pass `activeHref` to stop passing it.

---

## Execution Order

Run A first (uuid migration unblocks seed data). Then run B, C, D, E, F in parallel.

## MVP Readiness

**Was:** 28/100 (Agent 4)  
**After this council's prompts:** ~33/100  
**Path to 55%:** ADR-0030 Phase A (33-page legacy migration) + transcript issuance write workflow + course registration student UI  
**Full MVP (85%):** Billing foundation + admissions portal + compliance reports — 4–6 factory sprint cycles
