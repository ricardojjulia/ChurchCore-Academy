# Factory Prompt — Academic Foundation

**Date:** 2026-07-02
**Status:** Ready for execution
**Target implementation:** ChurchCore Academy — Academic Foundation (build order items 1–4)

---

## What You Are Building and Why

You are implementing the **Academic Foundation** — the first four features in the ChurchCore
Academy Core Academic Loop that must exist before anything else can be built:

1. **Academic Periods UI** — inline period management inside the Academic Year detail page
2. **Academic Year + Period Context Picker** — persistent year/period selector in every admin page
3. **Course Catalog UI** — create, edit, archive, activate courses
4. **Program Management UI** — create, edit, archive programs with a detail page

Without these four features, no enrollment, no section management, no grading, and no student
progress tracking can exist. This is the foundation.

A feature is done when an admin can complete the workflow end-to-end in a browser without hitting
a dead end, a 404, or a missing action. A passing build is not done.

---

## Read These First — In This Order

Before writing any code, read these documents in order. Do not skip any of them.

1. `/Users/rjulia/ChurchCore Academy/CLAUDE.md` — architecture rules, non-negotiable
2. `/Users/rjulia/ChurchCore Academy/docs/product/product-context.md` — what we are building and why, definition of done
3. `/Users/rjulia/ChurchCore Academy/docs/superpowers/specs/2026-07-02-academic-foundation-design.md` — field-level, API-level, UI-level design spec for all four features
4. `/Users/rjulia/ChurchCore Academy/docs/superpowers/plans/2026-07-02-academic-foundation.md` — numbered task list in dependency order
5. `docs/adr/0064-academic-foundation-context-picker-render-strategy.md` — how the context picker is rendered
6. `docs/adr/0065-academic-period-overlap-warn-not-block.md` — overlap is a warning, not a hard block
7. `docs/adr/0066-course-code-uniqueness-enforcement.md` — both DB constraint and module pre-check
8. `docs/adr/0067-academic-periods-ui-inline-within-year.md` — periods managed inline in year detail

---

## Reference Files — Read for Patterns

Read these before writing any code. They show the exact patterns you must match.

**Existing mutations (patterns to follow and extend):**
- `src/modules/academic-calendar/mutations.ts` — createTerm, updateTerm, archiveTerm, deleteTerm, transitionTermState, closeTerm
- `src/modules/course-catalog/mutations.ts` — createCourse, updateCourse, archiveCourse, activateCourse, createSection

**Existing types (understand before adding new fields):**
- `src/modules/academic-calendar/types.ts` — AcademicPeriod, AcademicYear, AcademicPeriodType, AcademicLifecycleState
- `src/modules/course-catalog/types.ts` — Course, CourseType, CourseLevel, CourseStatus
- `src/modules/academic-programs/types.ts` — AcademicProgram, ProgramStatus, validateCreateProgramInput

**Existing API routes (patterns to follow):**
- `src/app/api/academy/courses/route.ts` — POST + GET pattern
- `src/app/api/academy/courses/[id]/route.ts` — GET + PATCH pattern
- `src/app/api/academy/programs/route.ts` — same pattern
- `src/app/api/academy/calendar/periods/route.ts` — GET pattern

**Existing UI pages (patterns to follow):**
- `src/app/admin/settings/calendar/page.tsx` — server component fetching via withAcademyDatabaseContext
- `src/app/admin/settings/calendar/CalendarClient.tsx` — Tabs + Card + Table + dialog buttons
- `src/app/admin/settings/calendar/CreatePeriodButton.tsx` — Dialog + react-hook-form + Controller pattern
- `src/app/admin/settings/calendar/PeriodActions.tsx` — DropdownMenu + AlertDialog + handleTransition pattern
- `src/app/admin/settings/calendar/CreateYearButton.tsx` — same dialog pattern for reference
- `src/app/admin/courses/page.tsx` — server component + client action buttons
- `src/app/admin/courses/course-actions.tsx` — NewCourseButton using Dialog (to be refactored)
- `src/app/admin/programs/page.tsx` — program index with metric cards
- `src/app/admin/programs/new/page.tsx` — create program page using ProgramCreateForm

**Existing infrastructure (use as-is, do not modify):**
- `src/app/api/academy/api-utils.ts` — handleApi, jsonOk, jsonError — use for all API routes
- `src/lib/academy-database-context.ts` — withAcademyDatabaseContext, asAcademyDatabase
- `src/modules/academy-auth/request-context.ts` — resolveAcademyActorFromSession
- `src/lib/require-actor.ts` — requireActor for server components
- `src/lib/ui/notifications.ts` — notifyAcademy — use for all user feedback (not alert())
- `src/components/admin-shell.tsx` — AdminShell component (to be extended with context picker)
- `src/modules/academy-auth/errors.ts` — AcademyConflictError, AcademyAuthorizationError

**UI component library (import from these paths):**
- `src/components/ui/button.tsx`
- `src/components/ui/dialog.tsx` — Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/select.tsx` — note: this is a custom Select, not shadcn's Select
- `src/components/ui/badge.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/tabs.tsx`

**CSS patterns:**
- Check `src/app/globals.css` for existing class names before defining new ones
- Do not use classes in JSX before defining them in globals.css
- Required new classes are specified in the design spec

---

## Implementation Summary

Execute tasks in the order specified in the implementation plan. Do not skip ahead.

### Phase 1 — Migrations (Tasks 1–2)

**Task 1:** Create `supabase/migrations/20260702000000_period_sequence_unique.sql`
- Add unique index on `(tenant_id, academic_year_id, sequence)` to `academy_academic_periods`
- Use `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS`

**Task 2:** Create `supabase/migrations/20260702000100_academy_user_context.sql`
- New table `academy_user_context (user_id text, tenant_id text, active_academic_year_id text, active_academic_period_id text, updated_at timestamptz, PRIMARY KEY (user_id, tenant_id))`
- Enable and force RLS with read-own and write-own policies using `auth.uid()::text`
- No foreign keys from the context columns (resilience if year/period deleted)

### Phase 2 — Backend (Tasks 3–8)

**Task 3:** Extend `src/modules/academic-calendar/mutations.ts`
- Add `periodType: AcademicPeriodType` to `CreateTermInput` (stop hardcoding `'term'`)
- Add overlap detection returning `{ period, warnings: OverlapWarning[] }` from createTerm/updateTerm
- Add sequence uniqueness pre-check throwing `AcademyConflictError` on duplicate

**Task 4:** Create `src/modules/academic-calendar/user-context-repository.ts`
- Export `resolveAcademicContext(userId, tenantId, client)` and `saveAcademicContext(...)`
- Resolution defaults: active year with most recent starts_on → active period (today in range) → first by sequence
- Create tests in `__tests__/user-context-repository.test.ts`

**Task 5:** Create API routes under `src/app/api/academy/calendar/years/[id]/`:
- `route.ts` — GET year with periods
- `periods/route.ts` — POST create period
- `periods/[periodId]/route.ts` — PATCH edit period, DELETE delete period
- `periods/[periodId]/status/route.ts` — PATCH transition status
- All routes: handleApi + resolveAcademyActorFromSession + withAcademyDatabaseContext

**Task 6:** Create `src/app/api/academy/user-context/route.ts`
- GET: calls resolveAcademicContext and returns { context, options }
- PUT: saves and returns updated context (when yearId changes, clear periodId)

**Task 7:** Extend `src/app/api/academy/courses/[id]/route.ts`
- Add DELETE handler: only draft courses with no sections can be deleted
- Verify PATCH handles status → archive and status → active flows correctly

**Task 8:** Extend `src/modules/academic-programs/postgres-repository.ts`
- Add `archive(tenantId, id)` and `delete(tenantId, id)` methods
- Extend `src/app/api/academy/programs/[id]/route.ts` with DELETE handler

### Phase 3 — Frontend (Tasks 9–12)

**Task 9:** Academic Year detail page with inline period management
- `src/app/admin/settings/calendar/years/[id]/page.tsx` — server component
- `YearDetailClient.tsx` — periods table with Add/Edit/Transition/Delete
- `CreatePeriodDialog.tsx` — fields: name, code, periodType, startsOn, endsOn, sequence; shows overlap warning
- `EditPeriodDialog.tsx` — same fields pre-populated; handles locked fields
- `PeriodRowActions.tsx` — Edit, Open Enrollment, Activate, Complete, Archive, Delete actions
- Update `CalendarClient.tsx` — year names become links to year detail page
- Add `.period-overlap-warning` class to `globals.css`

**Task 10:** Academic Year + Period Context Picker
- `src/components/AcademicContextPicker.tsx` — two selects (year, period); calls PUT user-context; router.refresh()
- Extend `AdminShell` props: `academicContext?`, `academicContextOptions?`
- Remove cookie-based period selector from AdminShell
- Create/extend `src/app/admin/layout.tsx` to fetch and inject context from DB on each server render
- Add `.admin-context-picker`, `.admin-context-picker-select`, `.admin-context-picker-divider` to globals.css

**Task 11:** Course Catalog create/edit/archive UI
- `src/app/admin/courses/CourseFormDialog.tsx` — unified create/edit dialog with all fields
- `src/app/admin/courses/CourseRowActions.tsx` — Edit, Activate, Archive, Delete per row
- Update `course-actions.tsx` to use CourseFormDialog
- Update `courses/page.tsx` to add CourseRowActions to each row

**Task 12:** Program Management detail page + edit/archive UI
- `src/app/admin/programs/[id]/page.tsx` — server component (findById)
- `src/app/admin/programs/[id]/ProgramDetailClient.tsx` — detail card, edit, archive
- `src/app/admin/programs/ProgramRowActions.tsx` — Edit, Archive, Delete per row
- Update `program-create-form.tsx` to accept `initialValues` for edit mode
- Update `programs/page.tsx` — link program names, add ProgramRowActions

### Phase 4 — Integration and Tests (Tasks 13–16)

**Task 13:** Remove cookie-based period selector
- Run: `grep -r "academic_period_id" src/` and replace every cookie read/write with DB-backed context

**Task 14:** Period mutation tests (expanded)
**Task 15:** User context + program archive/delete tests
**Task 16:** Final verification — `npm test && npm run lint && npm run build` + browser walkthrough

---

## Critical Rules That Must Not Be Violated

1. **Never use `alert()` in client components.** Use `notifyAcademy({ tone, title, message })`.

2. **Never surface raw DB error messages to the client.** Map all errors in the module layer or via `handleApi`.

3. **Every new API route must use `withAcademyDatabaseContext`.** Never call the DB pool directly from a route.

4. **Tenant isolation is required on every query.** Every SQL query must include `tenant_id = $N` for the actor's tenantId.

5. **CSS classes must exist in globals.css before use.** Check the file. Add new classes to globals.css before referencing them in JSX.

6. **No Moodle, no LMS runtime code.** This is a SIS — course catalog and periods are SIS records, not LMS records.

7. **Overlap detection returns a warning, not an error.** The period is saved. The API returns HTTP 200 with a `warnings` array. The UI shows the warning as a non-blocking banner.

8. **Sequence uniqueness is a hard error.** Duplicate sequence within the same year throws `AcademyConflictError` → HTTP 409.

9. **The context picker reads from the DB, not a cookie.** The `academic_period_id` cookie is removed entirely. The `academy_user_context` table is the persistence layer.

10. **Tests must create their own prerequisite data.** A test for period creation must first create the academic year. A test for course update must first create the course. No mock data shortcuts.

11. **No `any` type unless the existing file already uses it.** TypeScript strict mode.

12. **Do not refactor code outside the task scope.** If you notice something unrelated needs cleaning, note it in the PR description — do not change it.

13. **Use `router.refresh()` after client-side mutations.** Do not `window.location.reload()` (breaks Next.js state).

14. **Forms use `react-hook-form` with `Controller` for Select fields** — follow the pattern in `CreatePeriodButton.tsx` and `CreateYearButton.tsx`.

15. **Programs use `uuid` as their primary key type, not `text`.** When querying programs by ID string param, cast: `id = $2::uuid` or `id::text = $2`. Check existing repo for the pattern.

---

## Verification Commands

Run these before marking any task complete:

```bash
npm test
npm run lint
npm run build
```

All three must pass with zero errors.

---

## Browser Walkthrough (Definition of Done)

After `npm test && npm run lint && npm run build` all pass, verify these workflows in the browser:

1. Log in → Topbar shows Academic Year selector and Period selector. Changing year updates period options. Changing period persists after browser refresh.

2. Settings → Calendar → Click a year name → Year detail page loads with periods table. Add a period with name, code, type, start date, end date, sequence. Period appears in list. Edit it. Transition it through lifecycle states.

3. Academics → Course Catalog → Create a course with code, title, type, level, credit hours. Course appears in list with status badge. Edit it. Archive it. Activate it.

4. Programs → Create a new program via "Create new program →" link. Program appears in list. Click program name → detail page loads. Edit the program. Archive it.

---

## Delivery Format

When implementation is complete, provide:

1. **Files created** — list of new files with one-line description
2. **Files modified** — list of changed files with summary of change
3. **Migrations** — list migration file names
4. **Test results** — output of `npm test` (pass counts, no failures)
5. **Lint/build** — confirm `npm run lint` and `npm run build` passed
6. **Browser walkthrough** — which workflows were tested and confirmed working
7. **Deferred / risks** — any items not completed and why
