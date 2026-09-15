# Council Review V — Synthesis

_Date: 2026-06-18_
_Agents: 4 parallel audits (SIS state, routes, UX, competitive)_
_ADRs issued: ADR-0030, ADR-0031_

---

## Cross-Agent Consensus (highest priority — flagged by 2+ agents)

| Finding | Agents | Severity |
|---|---|---|
| `loadProtectedAcademyDataset` in runtime pages (`/admin/transcripts`, `/admin/workflows`) | A1, A2 | Critical — arch violation |
| Workflow evaluator running synchronously on page render | A1, A3 | Critical — arch + perf |
| 8 admin pages missing `loading.tsx` | A3 (pain point #3), confirmed by A1 page list | High |
| Mobile sidebar not closing on nav link tap | A3 (pain point #2), A2 (UX) | High |
| Admin search — no keyboard navigation, no ARIA combobox | A3 (pain point #1) | High — accessibility blocker |
| Faculty grade entry + assignment CRUD missing | A1 (gap #3), A4 (competitive gap #1) | High — MVP blocker |
| Student registration UI absent from PWA | A1, A4 | High — MVP blocker |
| Undefined CSS custom properties in legacy block | A3 | Medium |
| Guardian relationship seed missing | A1 | Medium |

---

## ADRs Issued

- **ADR-0030** — Legacy dataset deprecation strategy: no new `loadProtectedAcademyDataset` imports; phased removal.
- **ADR-0031** — Workflow evaluator invocation pattern: never run evaluator on page render; use explicit POST only.

---

## Implementation Prompts

### Prompt A — Mobile Sidebar: Close on Nav Link Tap

**ADR Reference:** None (UX fix)
**Files:** `src/components/admin-shell.tsx`, `src/components/faculty-shell.tsx`
**Scope:** Both shells have a mobile sidebar that opens via a hamburger toggle but never closes when a nav link is tapped. Add a callback so every nav link click calls `setSidebarOpen(false)`.

**Work:**
1. In `AdminShellInner`: pass `() => setSidebarOpen(false)` as an `onClick` prop to each `<Link>` in the nav items loop.
2. In `FacultyShell`: same — add `onClick={() => setSidebarOpen(false)}` to each nav link.
3. Both shells already have the `sidebarOpen` state; no new state is needed.

**Verification:**
- npm test && npm run lint && npm run build
- Manually confirm on a narrow viewport: tap hamburger → nav opens; tap a nav item → nav closes and page navigates.

---

### Prompt B — Admin Search: ARIA Combobox + Keyboard Navigation

**ADR Reference:** None (accessibility fix)
**Files:** `src/components/admin-shell.tsx`
**Scope:** The admin search input is missing `role="combobox"` and all associated ARIA wiring. Arrow-key navigation between results does not work. Fix both.

**Work:**
1. Add `activeResultIndex` state (number, -1 = none selected).
2. On the search `<input>`:
   - Add `role="combobox"`, `aria-haspopup="listbox"`, `aria-autocomplete="list"`.
   - Add `aria-controls="admin-search-listbox"`.
   - Add `aria-activedescendant={activeResultIndex >= 0 ? \`search-result-\${filtered[activeResultIndex]?.id}\` : undefined}`.
   - Add `onKeyDown` handler: ArrowDown moves index forward, ArrowUp moves back, Enter activates the focused result, Escape closes the dropdown.
3. On the listbox `<div>`:
   - Add `id="admin-search-listbox"`.
4. On each result `<div role="option">`:
   - Add `id={\`search-result-\${entry.id}\`}`.
   - Add `aria-selected={activeResultIndex === index}`.
5. Reset `activeResultIndex` to -1 when `searchQuery` changes or dropdown closes.

**Verification:**
- npm test && npm run lint && npm run build
- Type in search, press ArrowDown — first result is highlighted; press Enter — student context is set; press Escape — dropdown closes.

---

### Prompt C — Loading Skeletons for Remaining Admin Pages

**ADR Reference:** ADR-0025 (loading state strategy)
**Files:** 8 new `loading.tsx` files
**Scope:** Eight admin pages have no `loading.tsx` and show a blank white flash on slow connections. Add a consistent skeleton matching the `.ops-loading-*` pattern already used elsewhere.

**Work:**
Create each file as a server component returning the standard skeleton structure. Use these layouts:
- Pages with a table only (staff, courses, sections, settings/institution, settings/calendar, settings/people): eyebrow + title skeleton + table skeleton.
- Pages with stat cards + table (transcripts, gradebook): eyebrow + title + 3 stat cards + table skeleton.

Files to create:
1. `src/app/admin/transcripts/loading.tsx` — stat cards (3) + table
2. `src/app/admin/staff/loading.tsx` — table only
3. `src/app/admin/courses/loading.tsx` — table only
4. `src/app/admin/sections/loading.tsx` — table only
5. `src/app/admin/gradebook/loading.tsx` — stat cards (3) + table
6. `src/app/admin/settings/institution/loading.tsx` — table only
7. `src/app/admin/settings/calendar/loading.tsx` — table only
8. `src/app/admin/settings/people/loading.tsx` — table only

**Verification:**
- npm test && npm run lint && npm run build

---

### Prompt D — CSS Token Definitions

**ADR Reference:** None (CSS hygiene)
**Files:** `src/styles/tokens.css`
**Scope:** Several CSS custom properties used in `admin.css` and `student-pwa.css` are not defined in `tokens.css`, causing them to fall back to transparent/initial. Add the missing tokens.

**Work:**
Add to the `:root` block in `tokens.css`:
```css
/* Semantic status tokens */
--primary: #2563eb;
--success: #16a34a;
--warning: #d97706;
--danger: #dc2626;

/* Surface and text tokens */
--background: #ffffff;
--foreground: #111827;
--muted-foreground: #6b7280;
--panel-border: #e5e7eb;

/* Student PWA gradient tokens */
--surface-gradient: linear-gradient(146deg, rgba(241,248,255,0.96), rgba(218,232,250,0.94));
--surface-soft-gradient: linear-gradient(180deg, rgba(250,253,255,0.94), rgba(230,242,255,0.9));

/* Radius tokens */
--radius-panel: 1rem;
```

**Verification:**
- npm test && npm run lint && npm run build
- Visually inspect `/admin/students` and `/student` for correct token rendering (no transparent borders, correct status colors).

---

### Prompt E — Workflows Page: Stop Running Evaluator on Page Render

**ADR Reference:** ADR-0031 (workflow evaluator invocation pattern)
**Files:**
- `src/app/admin/workflows/page.tsx`
- `src/app/faculty/shepherd/page.tsx`
- `src/modules/academic-workflows/types.ts` (new)
- `src/modules/academic-workflows/__tests__/types.test.ts` (new)
**Scope:** Both pages currently call `runAcademicWorkflowEvaluationJob` on every render. Per ADR-0031, pages must only read from the `ai_suggestions` DB table. The evaluator is triggered explicitly via `POST /api/academy/shepherd-ai/evaluate`. Add a "Re-evaluate" button to both pages.

**Work:**
1. In `src/app/admin/workflows/page.tsx`:
   - Remove the `runAcademicWorkflowEvaluationJob` call.
   - Load suggestions directly from `ShepherdAiPostgresRepository.listSuggestions(tenantId)` via `withAcademyDatabaseContext`.
   - Pass a `reEvaluateEndpoint="/api/academy/shepherd-ai/evaluate"` prop to `WorkflowQueueBoard`.
2. In `src/app/faculty/shepherd/page.tsx`:
   - Same — remove evaluator call; load from repository; pass re-evaluate prop.
3. Update `WorkflowQueueBoard` (or create a small `ReEvaluateButton` client component) to POST to `/api/academy/shepherd-ai/evaluate` with a loading indicator.
4. Create `src/modules/academic-workflows/types.ts` — export `WorkflowStatus`, `WorkflowAction`, `WorkflowFeedbackInput` types (inferred from `repository.ts`).
5. Create `src/modules/academic-workflows/__tests__/types.test.ts` — at minimum a smoke test that the type file exports the expected symbols.

**Security:** `POST /api/academy/shepherd-ai/evaluate` must verify the actor has `academic_admin` role before running the evaluator. Check the existing handler and add the guard if missing.

**Verification:**
- npm test && npm run lint && npm run build
- Workflows page loads with DB suggestions, no evaluator cost on render.
- Clicking Re-evaluate triggers POST, suggestions list refreshes.

---

### Prompt F — Demo Seed: Attendance, Guardian Relationships, Transcript Issuances

**ADR Reference:** None (data completeness)
**Files:** `supabase/migrations/20260618030000_seed_demo_extended.sql` (new)
**Scope:** Three seed gaps leave the demo dataset inconsistent: no attendance records, no guardian-student relationship rows, no transcript issuances. Add a migration that fills these for the existing demo personas without modifying any prior migration.

**Work:**
1. Attendance records: seed 5–8 rows in `academy_attendance_records` for `person-leah-brooks` and `person-daniel-hart` across 2–3 section meetings (present/absent mix).
2. Guardian relationship: seed 1 row in `academy_student_relationships` linking `person-guardian-richard-price` as guardian to `person-naomi-price` (student).
3. Transcript issuances: seed 1 issued transcript in `academy_transcript_issuances` for `person-naomi-price` (delivery_method: `digital_download`, issued status).
4. Evaluation scales: seed 1 grading scale row in `academy_evaluation_scales` and 5 band rows in `academy_evaluation_scale_bands` (A/B/C/D/F or equivalent) for `cca-main` tenant so the grading config screen shows a realistic default.

**Verification:**
- Apply migration to local Supabase: `supabase db reset` or `supabase migration up`.
- npm test && npm run lint && npm run build
- `/admin/staff` demo shows guardian relationship present; `/student` demo shows transcript issued.

---

## Execution Order

**Independent (run in parallel):**
- Prompt A (mobile sidebar close)
- Prompt C (loading skeletons)
- Prompt D (CSS tokens)
- Prompt F (demo seed)

**Sequential dependencies:**
- Prompt B (search ARIA) — independent but complex; run after A to avoid merge conflicts on `admin-shell.tsx`
- Prompt E (workflow evaluator) — independent of A–D; requires `ShepherdAiPostgresRepository.listSuggestions` to be confirmed available before starting

**Defer to dedicated sprint (out of scope for this prompt set):**
- Legacy dataset migration (ADR-0030 Phase A) — too large for a single prompt; needs its own sprint
- Faculty grade entry / assignment CRUD (A4 competitive gap #1)
- Student registration UI
- Financial management (Phase 12)
