# Academic Foundation — Design Spec

**Date:** 2026-07-02
**Author:** Academic Foundation Council
**Status:** Approved for implementation
**ADRs:** ADR-0064, ADR-0065, ADR-0066, ADR-0067
**Depends on:** `CLAUDE.md`, `docs/product/product-context.md`

---

## Overview

This spec covers the four foundation features that must exist before any other step in the Core
Academic Loop can be built:

1. Academic Periods UI — manage periods within an Academic Year
2. Academic Year + Period Context Picker — persistent year/period selector in every admin page
3. Course Catalog UI — create, edit, archive courses
4. Program Management UI — create, edit, archive programs

These features do not depend on each other except that (2) requires (1) to have periods to
select. All four can be built concurrently if staffing allows, but (1) must be deployable before
(2) is useful.

---

## Feature 1: Academic Periods UI

### What exists today

- `academy_academic_periods` table — fully defined in migrations, supports `planned` → `enrollment_open` → `active` → `completed` → `archived` lifecycle.
- `src/modules/academic-calendar/mutations.ts` — `createTerm`, `updateTerm`, `closeTerm`,
  `transitionTermState`, `archiveTerm`, `deleteTerm`, `createPeriod`, `updatePeriod`,
  `archivePeriod`, `deletePeriod`. All mutations exist and are tested.
- `/admin/settings/calendar` — flat list of all periods across all years (CalendarClient.tsx).
  Has "Create Period" dialog and PeriodActions dropdown. Missing: edit-in-place, sequence field,
  period type field in the create form.
- `/api/academy/calendar/periods/[id]` — DELETE route exists.

### What is missing

- A year detail page at `/admin/settings/calendar/years/[id]`.
- The "Create Period" dialog does not expose `periodType` or `sequence` fields.
- No edit dialog for an existing period (only state transitions and delete exist in PeriodActions).
- The flat period list in CalendarClient does not link year names to detail pages.
- Overlap detection + warning response from the API.

### Data model

No new tables. Existing `academy_academic_periods` is used as-is:

```sql
-- Key columns used by this feature:
-- id text primary key
-- tenant_id text not null
-- academic_year_id text not null
-- name text not null
-- code text not null
-- period_type text not null   (existing AcademicPeriodType)
-- starts_on date not null
-- ends_on date not null
-- sequence integer not null
-- status text not null        (AcademicLifecycleState)
-- unique (tenant_id, academic_year_id, code)
-- unique (tenant_id, academic_year_id, sequence)  -- add this constraint via migration
```

**Migration needed: add unique constraint on (tenant_id, academic_year_id, sequence).**

File: `supabase/migrations/YYYYMMDDHHMMSS_period_sequence_unique.sql`

```sql
alter table academy_academic_periods
  add constraint academy_academic_periods_tenant_year_seq_unique
  unique (tenant_id, academic_year_id, sequence);
```

Note: Run CONCURRENTLY if table has data to avoid lock:
```sql
create unique index concurrently if not exists
  academy_academic_periods_tenant_year_seq_unique_idx
  on academy_academic_periods (tenant_id, academic_year_id, sequence);
```

### Period type values (for the UI Select)

The existing `AcademicPeriodType` in types.ts includes: `term | session | module | intensive | grading_period | reporting_period | break`.

For the Periods UI, the user-facing type options are:
- `term` — Semester (label: "Semester / Term")
- `session` — Quarter / Session (label: "Quarter / Session")
- `module` — Module (label: "Module")
- `intensive` — Intensive (label: "Intensive")

Grading period, reporting period, and break are internal/system types, not selectable in the
primary admin UI (they may be added later).

### Module functions to add or modify

**In `src/modules/academic-calendar/mutations.ts`:**

`createTerm` — extend to accept `periodType` parameter (currently hardcodes `'term'`):
```typescript
export interface CreateTermInput {
  academicYearId: string;
  name: string;
  code: string;
  periodType: AcademicPeriodType;   // was missing — add this
  startsOn: string;
  endsOn: string;
  sequence: number;
  // existing optional fields remain
}
```

Add overlap detection to `createTerm` and `updateTerm`:
```typescript
// After year boundary check, before insert:
const overlaps = await client.query(
  `select id, name from academy_academic_periods
   where tenant_id = $1 and academic_year_id = $2
     and id != $3
     and starts_on < $5 and ends_on > $4`,
  [actor.tenantId, input.academicYearId, periodId ?? 'none', input.startsOn, input.endsOn]
);
// If overlaps.rows.length > 0, collect warning — do not throw.
```

Return type changes: `createTerm` and `updateTerm` return:
```typescript
interface TermMutationResult {
  period: AcademicPeriod;
  warnings: Array<{ code: string; message: string; overlappingPeriodIds: string[] }>;
}
```

### New API routes

**`GET /api/academy/calendar/years/[id]`** (new)
- Auth: requires authenticated actor, tenant isolation
- Returns: `{ year: AcademicYear, periods: AcademicPeriod[] }`
- Error: 404 if year not found or belongs to different tenant

**`POST /api/academy/calendar/years/[id]/periods`** (new)
- Body: `{ name, code, periodType, startsOn, endsOn, sequence }`
- Returns: `{ period: AcademicPeriod, warnings: [] }`
- Error: 400 validation, 409 conflict (duplicate code or sequence), 403 auth

**`PATCH /api/academy/calendar/years/[id]/periods/[periodId]`** (new)
- Body: partial update of `{ name?, code?, periodType?, startsOn?, endsOn?, sequence? }`
- Returns: `{ period: AcademicPeriod, warnings: [] }`
- Same lock rules as ADR-0050: dates locked when sections assigned or status is active+

**`PATCH /api/academy/calendar/years/[id]/periods/[periodId]/status`** (new)
- Body: `{ action: "open_enrollment" | "activate" | "complete" | "archive" }`
- Returns: `{ period: AcademicPeriod }`

**Existing routes reused:**
- `DELETE /api/academy/calendar/periods/[id]` — already exists
- `GET /api/academy/calendar/periods` — already exists (returns all periods for tenant)

### New UI pages and components

**`src/app/admin/settings/calendar/years/[id]/page.tsx`** (new server component)
- Fetches year + its periods via `withAcademyDatabaseContext`.
- Renders `AdminShell` with eyebrow "Settings / Calendar" and title = year name.
- Renders `YearDetailClient` with `{ year, periods }` as props.

**`src/app/admin/settings/calendar/years/[id]/YearDetailClient.tsx`** (new client component)
- Props: `{ year: AcademicYear, periods: AcademicPeriod[], onRefresh: () => void }`
- Renders:
  - Year header card: name, code, dates, status, calendar system — with "Edit" inline action
  - "Periods" section: table of periods sorted by `sequence`
  - "Add Period" button → `CreatePeriodDialog`
  - Each period row: name, code, type badge, start-end dates, sequence, status badge, actions dropdown

**`src/app/admin/settings/calendar/years/[id]/CreatePeriodDialog.tsx`** (new client component)
- Fields: Name, Code (auto-upcased), Period Type (Select), Start Date, End Date, Sequence (number)
- Submits to `POST /api/academy/calendar/years/[id]/periods`
- On success with warnings: shows period + yellow warning alert
- On success without warnings: closes dialog

**`src/app/admin/settings/calendar/years/[id]/EditPeriodDialog.tsx`** (new client component)
- Same fields as Create, but pre-populated; locked fields shown as read-only with lock icon
- Submits to `PATCH /api/academy/calendar/years/[id]/periods/[periodId]`

**`src/app/admin/settings/calendar/years/[id]/PeriodRowActions.tsx`** (new client component)
- Dropdown: Edit, Open Enrollment, Activate, Complete, Archive, Delete
- Confirmation dialog for Complete and Archive
- Calls status route or edit dialog

**Update to `src/app/admin/settings/calendar/CalendarClient.tsx`:**
- In the Academic Years tab, the year name cell becomes a `<Link href="/admin/settings/calendar/years/[year.id]">` so admins can navigate to the year detail.

### Validation rules

| Rule | Enforcement |
|------|-------------|
| Period cannot start before year start | Module layer (400) |
| Period cannot end after year end | Module layer (400) |
| starts_on must be before ends_on | Module layer (400) |
| Code unique within year | DB constraint + module pre-check (409) |
| Sequence unique within year | DB constraint + module pre-check (409) |
| Date overlap with sibling period | Module layer: warn only, return 200 with warnings |
| Archived periods are read-only | Module layer: reject edits on archived status (400) |
| Active/enrollment_open: dates locked | Module layer (400 if dates change) |
| Sections assigned: dates locked | Module layer (400 if dates change) |

### CSS classes needed

The following CSS classes are already defined in `globals.css` and must be reused:
- `ops-panel`, `ops-heading`, `ops-icon`, `ops-stats-grid`, `ops-metric`
- `student-empty-state`
- `admin-eyebrow`, `admin-title`

New CSS classes needed in `globals.css`:
```css
/* Year detail inline period table warning banner */
.period-overlap-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: hsl(var(--warning) / 0.1);
  border: 1px solid hsl(var(--warning) / 0.3);
  border-radius: 0.375rem;
  color: hsl(var(--warning-foreground));
  font-size: 0.875rem;
  margin-bottom: 1rem;
}
```

---

## Feature 2: Academic Year + Period Context Picker

### What exists today

- The admin shell (`src/components/admin-shell.tsx`) renders a period selector in the topbar
  using a client `useEffect` that fetches `/api/academy/calendar/periods` and reads/writes the
  `academic_period_id` cookie.
- The cookie mechanism is per-browser, not per-user, and only covers period (not year).
- No `academy_user_context` table exists yet.

### Data model — new table

**Migration file:** `supabase/migrations/YYYYMMDDHHMMSS_academy_user_context.sql`

```sql
create table if not exists public.academy_user_context (
  user_id                  text not null,
  tenant_id                text not null,
  active_academic_year_id  text,
  active_academic_period_id text,
  updated_at               timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

-- RLS: each user sees only their own context row
alter table public.academy_user_context enable row level security;
alter table public.academy_user_context force row level security;

create policy "Users read own context"
  on public.academy_user_context
  for select
  using (user_id = auth.uid()::text);

create policy "Users write own context"
  on public.academy_user_context
  for all
  using (user_id = auth.uid()::text);
```

Note: No FK from `active_academic_year_id` to `academy_academic_years.id`. The context row must
survive even if a year is archived/deleted — graceful null-out via the API.

### Read model for context resolution

A new function in `src/lib/academy-read-models.ts` or a new
`src/modules/academic-calendar/user-context-repository.ts`:

```typescript
export interface AcademicContextRow {
  activeYearId: string | null;
  activePeriodId: string | null;
  yearName: string | null;
  periodName: string | null;
}

export interface AcademicContextOptions {
  years: Array<{ id: string; name: string; status: string }>;
  periodsByYear: Record<string, Array<{ id: string; name: string; status: string }>>;
}

// Fetches saved context + resolves default if none saved
export async function resolveAcademicContext(
  userId: string,
  tenantId: string,
  client: Queryable,
): Promise<{ context: AcademicContextRow; options: AcademicContextOptions }>;

// Saves context to DB
export async function saveAcademicContext(
  userId: string,
  tenantId: string,
  yearId: string | null,
  periodId: string | null,
  client: Queryable,
): Promise<void>;
```

Default resolution logic (when no saved context or saved IDs not found):
1. Find the `active` Academic Year with the most recent `starts_on` (or most recent `created_at`).
2. Within that year, find the `active` period with starts_on <= today <= ends_on.
3. If no active period, take the `planned` period with the earliest `sequence`.

### API routes

**`GET /api/academy/user-context`** (new)
- Auth: resolveAcademyActorFromSession
- Response:
```json
{
  "context": {
    "activeYearId": "...",
    "activePeriodId": "...",
    "yearName": "Academic Year 2026-2027",
    "periodName": "Fall 2026"
  },
  "options": {
    "years": [{ "id": "...", "name": "...", "status": "active" }],
    "periodsByYear": {
      "<yearId>": [{ "id": "...", "name": "...", "status": "active" }]
    }
  }
}
```

**`PUT /api/academy/user-context`** (new)
- Body: `{ activeYearId?: string | null, activePeriodId?: string | null }`
- Behavior: upsert into `academy_user_context`
- When `activeYearId` changes, `activePeriodId` is auto-cleared server-side
- Response: `{ context: AcademicContextRow }`

### AdminShell changes

The `AdminShell` component gains new props:

```typescript
export interface AcademicContext {
  activeYearId: string | null;
  activePeriodId: string | null;
  yearName: string | null;
  periodName: string | null;
}

export interface AcademicContextOptions {
  years: Array<{ id: string; name: string; status: string }>;
  periodsByYear: Record<string, Array<{ id: string; name: string; status: string }>>;
}

// Added to AdminShellProps:
academicContext?: AcademicContext;
academicContextOptions?: AcademicContextOptions;
```

The existing cookie-based period selector in the topbar is replaced by:

**`src/components/AcademicContextPicker.tsx`** (new client component)
- Props: `{ initialContext: AcademicContext, options: AcademicContextOptions }`
- Renders: two selects — Year select and Period select (period select options change when year changes)
- On year change:
  1. Optimistically update local state (year name, clear period)
  2. Call `PUT /api/academy/user-context` with `{ activeYearId, activePeriodId: null }`
  3. Auto-select the active/first period in the new year
  4. Call `router.refresh()` to re-run server fetches
- On period change:
  1. Optimistically update local state
  2. Call `PUT /api/academy/user-context` with `{ activePeriodId }`
  3. Call `router.refresh()`

### Admin layout injection (render strategy — ADR-0064)

**`src/app/admin/layout.tsx`** (new or extend existing):
- Server component
- Calls `resolveAcademicContext(actor.userId, actor.tenantId, client)` on each request
- Passes result as props to `AdminShell` via a context-aware shell wrapper
- Wrapped in `<Suspense fallback={<AdminShellSkeleton />}>`

If a Next.js layout already exists at `/app/admin/layout.tsx`, extend it. Otherwise create it.

The cookie-based selector is removed from `admin-shell.tsx`. The `academic_period_id` cookie is
no longer set or read after this feature ships.

### CSS classes needed

```css
/* Context picker in topbar — two selects side by side */
.admin-context-picker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.admin-context-picker-select {
  height: 2.25rem;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background-color: white;
  padding: 0 1.5rem 0 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
}

.admin-context-picker-divider {
  color: var(--text-muted);
  font-size: 0.85rem;
  user-select: none;
}
```

---

## Feature 3: Course Catalog UI

### What exists today

- `academy_courses` table — fully defined. Unique constraint `(tenant_id, code)` exists.
- `src/modules/course-catalog/mutations.ts` — `createCourse`, `updateCourse`, `archiveCourse`,
  `activateCourse` all exist and handle validation.
- `/api/academy/courses` — POST (create) and GET (list) exist.
- `/api/academy/courses/[id]` — GET and PATCH exist.
- `/admin/courses/page.tsx` — read-only list. Has `NewCourseButton` component but it is minimal
  (missing several fields, no edit action, no archive action per row).
- `src/app/admin/courses/course-actions.tsx` — `NewCourseButton` (dialog) and `NewSectionButton`
  (dialog) exist but are not comprehensive.

### What is missing

- `NewCourseButton` dialog is missing: `courseLevel`, `recordType`, `defaultClockHours`, `owningSubdivisionId` — it only sends `courseType` and `credits`.
- No row-level edit action (only create exists).
- No archive action per row.
- No course detail page.
- No activate action (to move `draft` → `active`).

### Data model

No new tables. `academy_courses` is used as-is. The `Course` interface in
`src/modules/course-catalog/types.ts` is complete.

The simplified field set for the Catalog UI (Phase 1 of catalog features):

| Field | Column | Type | UI control |
|-------|--------|------|------------|
| Title | `title` | text | Input (required) |
| Course Code | `code` | text (uppercased) | Input (required) |
| Description | `description` | text | Textarea |
| Credit Hours | `default_credits` | numeric | Number input |
| Clock Hours | `default_clock_hours` | numeric | Number input |
| Subject / Department | `owning_subdivision_id` | text FK | Select (optional, from institution subdivisions) |
| Course Type | `course_type` | enum | Select |
| Course Level | `course_level` | enum | Select |
| Status | `status` | enum | Badge + action buttons |

Note: `defaultDuration` is required by the DB but defaults gracefully. When only `defaultCredits`
is provided, set `defaultDuration = { durationUnit: "credit_hour", durationValue: defaultCredits, creditHours: defaultCredits }`. When only `defaultClockHours`, set `durationUnit: "clock_hour"`.

### Module functions — no changes needed

`createCourse`, `updateCourse`, `archiveCourse`, `activateCourse` in mutations.ts are all
complete and cover the needed operations.

`CourseCatalogService` in `src/modules/course-catalog/service.ts` wraps these and is used by
the API routes. No changes to the service.

### API routes

**`PATCH /api/academy/courses/[id]`** — already exists. Extend to handle `status` field for
activate and archive. The route already accepts `status` in body.

**`DELETE /api/academy/courses/[id]`** — new route (for hard-delete of draft courses with no
sections). Calls module-level delete check. Archived courses are never hard-deleted.

```typescript
// src/app/api/academy/courses/[id]/route.ts — add DELETE:
export async function DELETE(request: Request, { params }: Params) {
  // Only draft courses with no sections can be hard-deleted.
  // Archived courses stay in DB.
}
```

### New UI pages and components

**`src/app/admin/courses/page.tsx`** — update existing page:
- Add `CourseRowActions` component to the course rows (Edit, Archive, Activate)
- Fix `NewCourseButton` to collect all required fields

**`src/app/admin/courses/[id]/page.tsx`** (new server component — optional in Phase 1)
- Course detail view for future curriculum linkage
- For Phase 1: not strictly required if inline edit via dialog suffices

**`src/app/admin/courses/CourseFormDialog.tsx`** (new client component)
- Reusable for both create (no initialValues) and edit (with initialValues)
- Fields: title, code, courseType (Select), courseLevel (Select), description (Textarea),
  creditHours (number), clockHours (number), owningSubdivisionId (Select, optional)
- On submit: calls POST (create) or PATCH (edit)
- Replace the existing `NewCourseButton` with a `CourseFormDialog` wrapper

**`src/app/admin/courses/CourseRowActions.tsx`** (new client component)
- Dropdown: Edit, Activate (if draft), Archive (if active), Delete (if draft)
- Edit: opens `CourseFormDialog` pre-populated with course data
- Archive/Activate: calls PATCH with `{ status: "archived" }` or `{ status: "active" }`
- Delete: AlertDialog confirmation, calls DELETE route

### Validation rules

| Rule | Enforcement |
|------|-------------|
| Title required | Module layer (400) |
| Code required, uppercase | Module layer (400) |
| Code unique within tenant | DB constraint + module pre-check (409) |
| Cannot change code if sections exist | Module layer (400) |
| Cannot archive if active sections exist | Module layer (400) |
| Only draft/archived can be activated | Module layer (400) |
| description is required (empty string ok) | Module layer: already passes "" |

### CSS classes needed

No new CSS classes needed for Course Catalog UI. Existing `ops-panel`, `ops-heading`, `student-empty-state` are sufficient.

---

## Feature 4: Program Management UI

### What exists today

- `academy_academic_programs` table — fully defined (migration 20260616220000). Has `status`,
  `credential_type`, `program_code`, `title`, `required_credits`, etc.
- `src/modules/academic-programs/types.ts` — `AcademicProgram`, `CreateAcademicProgramInput`,
  `UpdateAcademicProgramInput`, `validateCreateProgramInput` all exist.
- `src/modules/academic-programs/postgres-repository.ts` — `list`, `findById`, `create`, `update`
  all exist.
- `/api/academy/programs` — GET (list) and POST (create) exist.
- `/api/academy/programs/[id]` — GET and PATCH exist.
- `/admin/programs/page.tsx` — read-only program index with metric cards and table.
- `/admin/programs/new/page.tsx` — create program form via `ProgramCreateForm` component.
- `src/components/program-create-form.tsx` — full create form (code, title, shortTitle,
  description, institutionMode, credentialType, gradeBand, requiredCredits, requiredClockHours).

### What is missing

- No edit action per program row.
- No archive action per program row.
- No program detail page (the index links to `/admin/programs/[id]` but no such page exists).
- `status` field is not shown or manageable in the UI.
- `subdivisionId` (owning department) not in create form.

### Data model

No new tables. `academy_academic_programs` is used as-is.

The simplified field set for the Program Management UI:

| Field | Column | Type | UI control |
|-------|--------|------|------------|
| Program Name | `title` | text | Input (required) |
| Program Code | `program_code` | text (uppercased) | Input (required) |
| Short Title | `short_title` | text | Input (optional) |
| Credential Type | `credential_type` | enum | Select (required) |
| Institution Mode | `institution_mode` | enum | Select (required) |
| Grade Band | `grade_band` | enum | Select (optional) |
| Required Credits | `required_credits` | numeric | Number input |
| Required Clock Hours | `required_clock_hours` | numeric | Number input |
| Description | `description` | text | Textarea |
| Owning Department | `subdivision_id` | uuid | Select from institution subdivisions |
| Status | `status` | enum | Badge + action |

### Module functions to add

**`src/modules/academic-programs/postgres-repository.ts`** — add:

```typescript
// Archive a program (set status = 'archived')
async archive(tenantId: string, id: string): Promise<AcademicProgram>;

// Delete a program (only if no student memberships exist)
async delete(tenantId: string, id: string): Promise<void>;
```

### API routes

**`/api/academy/programs/[id]`** — extend existing PATCH route to handle `status` field.

**`DELETE /api/academy/programs/[id]`** (new):
- Checks: no `academy_program_enrollments` rows for this program.
- If enrollments exist: returns 409 with count.
- If safe: hard-delete.

### New UI pages and components

**`src/app/admin/programs/[id]/page.tsx`** (new server component)
- Fetches program by ID via `withAcademyDatabaseContext` calling repo `findById`.
- Renders `AdminShell` with eyebrow "Programs" and title = program.title.
- Renders `ProgramDetailClient`.

**`src/app/admin/programs/[id]/ProgramDetailClient.tsx`** (new client component)
- Displays program metadata in a detail card (all fields, read-only initially).
- "Edit" button opens `ProgramFormDialog` pre-populated.
- "Archive" button (if status = active/draft): confirmation dialog → PATCH status.
- "Delete" button (if draft and no enrollments): confirmation dialog → DELETE.

**`src/components/ProgramFormDialog.tsx`** (new — replaces `ProgramCreateForm` for reuse)
- OR: update `src/components/program-create-form.tsx` to accept optional `initialValues` for edit.
- Fields: all fields from the field table above.
- On submit: calls POST (create) or PATCH (edit).
- The existing `/admin/programs/new/page.tsx` can continue using this component.

**`src/app/admin/programs/page.tsx`** — update existing:
- Add "Edit" and "Archive" actions to program rows.
- Program name cell becomes a `<Link href="/admin/programs/[id]">` for the detail page.

**`src/app/admin/programs/ProgramRowActions.tsx`** (new client component)
- Dropdown: Edit, Archive, Delete
- Edit: opens `ProgramFormDialog` pre-populated
- Archive: AlertDialog → PATCH `{ status: "archived" }`
- Delete: AlertDialog → DELETE

### Validation rules

| Rule | Enforcement |
|------|-------------|
| Program code required, uppercase | Module (400), DB unique (409) |
| Title required | Module (400) |
| institutionMode must be valid enum | Module (400) |
| credentialType must be valid enum | Module (400) |
| Code unique within tenant | DB constraint `unique(tenant_id, program_code)` + module pre-check |
| Cannot delete if enrollments exist | Repo check (409) |

### CSS classes needed

No new CSS classes needed for Program Management UI. Existing patterns are sufficient.

---

## Cross-Cutting: Existing API and Module Patterns

All new API routes must follow:

1. Use `handleApi()` from `src/app/api/academy/api-utils.ts` for error mapping.
2. Use `resolveAcademyActorFromSession(request)` for auth.
3. Use `withAcademyDatabaseContext(actor, ...)` for DB access.
4. Never surface raw DB errors to client.
5. Validate inputs in the module layer, not the route layer.

All new client components must follow:

1. Use `notifyAcademy({ tone, title, message })` from `src/lib/ui/notifications` for all
   success/error feedback (not `alert()`).
2. Use `useRouter().refresh()` after mutations to re-run server fetches.
3. Import UI primitives from `src/components/ui/` (Button, Dialog, Input, Label, Select, Badge,
   Table, etc.) — not from external libraries directly.
4. Define CSS classes in `src/app/globals.css` before using them in JSX.

---

## Test Coverage Requirements

Per CLAUDE.md: every module function must have success case, validation/rejection case, and
cross-tenant rejection case.

### Feature 1 — Periods

New tests in `src/modules/academic-calendar/__tests__/`:
- `createTerm` with `periodType` field
- `createTerm` overlap detection returns warning not error
- `updateTerm` with sequence uniqueness check
- API route tests for `POST /api/academy/calendar/years/[id]/periods`

### Feature 2 — Context Picker

New tests in `src/modules/academic-calendar/__tests__/` or new `user-context.test.ts`:
- `resolveAcademicContext`: no saved context → defaults to active year + active period
- `resolveAcademicContext`: saved context → returns saved values
- `saveAcademicContext`: upserts correctly
- Cross-tenant: cannot read another tenant's context

### Feature 3 — Courses

New tests in `src/modules/course-catalog/__tests__/`:
- `createCourse`: success, duplicate code (409), missing title (400)
- `updateCourse`: cross-tenant rejection
- `archiveCourse`: success, blocked by active sections
- `activateCourse`: draft → active, archived → active

### Feature 4 — Programs

New tests in `src/modules/academic-programs/__tests__/`:
- `archive`: success, cross-tenant rejection
- `delete`: success when no enrollments, blocked when enrollments exist
- Cross-tenant: `findById` rejects wrong tenant

---

## Deferred Items

The following are explicitly out of scope for this foundation sprint:

- **Prerequisites** — The `CoursePrerequisite` model exists in the DB but the UI for managing
  prerequisites is deferred to the next sprint (Program Curriculum / Phase 5 in build order).
- **Enrollment windows per period** — `academy_enrollment_windows` exists but managing them in
  the UI is deferred until the enrollment workflow (Phase 8 in build order).
- **Program curriculum (required courses per year)** — This is build order item 5, explicitly
  deferred after the catalog is in place.
- **Program details page tabs** (curriculum, student count, progress) — The detail page created
  here shows only the program header record.
