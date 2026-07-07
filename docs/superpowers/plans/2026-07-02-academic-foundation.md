# Academic Foundation — Implementation Plan

**Date:** 2026-07-02
**Author:** Academic Foundation Council
**Status:** Ready for execution
**Spec:** `docs/superpowers/specs/2026-07-02-academic-foundation-design.md`
**ADRs:** ADR-0064, ADR-0065, ADR-0066, ADR-0067

---

## Dependency Order

Read this before numbering tasks:

- Tasks 1–4 are infrastructure and migrations. No UI task may start before its migration lands.
- Tasks 5–8 are backend (module + API). No frontend task may start before its backend task.
- Tasks 9–12 are frontend. Each frontend task depends on its corresponding backend task.
- Task 13 is AdminShell integration (context picker). It depends on Task 6 (user-context API).
- Tasks 14–15 are test completion passes. They depend on all preceding tasks.
- Task 16 is the final verification pass.

---

## Tasks

### Task 1 — Migration: Period sequence unique constraint
**Depends on:** nothing
**Files to create:**
- `supabase/migrations/20260702000000_period_sequence_unique.sql`

**Content:**
```sql
-- ADR-0067: Period sequence must be unique within (tenant, academic_year)
create unique index concurrently if not exists
  academy_periods_tenant_year_seq_unique_idx
  on academy_academic_periods (tenant_id, academic_year_id, sequence);
```

**Success condition:** Migration applies without error against the local Supabase instance.
No existing data violates the constraint (verify with SELECT before adding).

---

### Task 2 — Migration: academy_user_context table
**Depends on:** nothing (can run in parallel with Task 1)
**Files to create:**
- `supabase/migrations/20260702000100_academy_user_context.sql`

**Content:**
```sql
create table if not exists public.academy_user_context (
  user_id                   text not null,
  tenant_id                 text not null,
  active_academic_year_id   text,
  active_academic_period_id text,
  updated_at                timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

alter table public.academy_user_context enable row level security;
alter table public.academy_user_context force row level security;

create policy "user_context_read_own"
  on public.academy_user_context for select
  using (user_id = auth.uid()::text);

create policy "user_context_write_own"
  on public.academy_user_context for all
  using (user_id = auth.uid()::text);
```

**Success condition:** Table and RLS policies exist. A test user's context can be upserted and
read back. Another user cannot read the first user's row.

---

### Task 3 — Backend: Extend createTerm and updateTerm with periodType + overlap detection
**Depends on:** Task 1 (sequence unique constraint)
**Files to modify:**
- `src/modules/academic-calendar/mutations.ts`
- `src/modules/academic-calendar/types.ts` (if needed for TermMutationResult)

**What to do:**

1. Add `periodType: AcademicPeriodType` to `CreateTermInput` interface. Remove the hardcoded
   `'term'` in the INSERT SQL and use `input.periodType` instead.

2. Add overlap detection after the year boundary check in `createTerm`:
```typescript
const overlaps = await client.query(
  `select id, name from academy_academic_periods
   where tenant_id = $1 and academic_year_id = $2
     and starts_on < $3 and ends_on > $4`,
  [actor.tenantId, input.academicYearId, input.endsOn, input.startsOn]
);
```

3. Change return type of `createTerm` and `updateTerm` to:
```typescript
type TermMutationResult = { period: AcademicPeriod; warnings: OverlapWarning[] };
interface OverlapWarning {
  code: "DATE_OVERLAP";
  message: string;
  overlappingPeriodIds: string[];
}
```

4. Add sequence uniqueness pre-check before INSERT:
```typescript
const seqConflict = await client.query(
  `select id from academy_academic_periods
   where tenant_id = $1 and academic_year_id = $2 and sequence = $3`,
  [actor.tenantId, input.academicYearId, input.sequence]
);
if (seqConflict.rowCount && seqConflict.rowCount > 0) {
  throw new AcademyConflictError(`A period with sequence ${input.sequence} already exists in this year.`);
}
```

**Success condition:** `npm test` passes. New test cases cover:
- createTerm with periodType = "session"
- createTerm with overlap → returns period + warnings array
- createTerm with duplicate sequence → throws AcademyConflictError

---

### Task 4 — Backend: User context repository
**Depends on:** Task 2 (migration)
**Files to create:**
- `src/modules/academic-calendar/user-context-repository.ts`
- `src/modules/academic-calendar/__tests__/user-context-repository.test.ts`

**What to build:**

```typescript
// user-context-repository.ts
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

export async function resolveAcademicContext(
  userId: string,
  tenantId: string,
  client: Queryable,
): Promise<{ context: AcademicContextRow; options: AcademicContextOptions }>;

export async function saveAcademicContext(
  userId: string,
  tenantId: string,
  activeYearId: string | null,
  activePeriodId: string | null,
  client: Queryable,
): Promise<void>;
```

Resolution logic in `resolveAcademicContext`:
1. SELECT saved context from `academy_user_context` for (userId, tenantId).
2. SELECT all non-archived years for tenant, ordered by starts_on desc.
3. SELECT all non-archived periods for tenant, ordered by academic_year_id, sequence.
4. If saved yearId is null or not found in years list: default to the active year
   (status='active', most recent starts_on), else first year.
5. If saved periodId is null or not found in that year: default to the active period within the
   selected year (status='active', starts_on <= today <= ends_on), else first period by sequence.
6. Return { context, options }.

**Test cases required:**
- No saved context: defaults to active year and active period
- Saved context year+period both valid: returns them
- Saved context with deleted year: falls back to default
- Cross-tenant: cannot read another tenant's years in options

**Success condition:** `npm test` passes with all cases.

---

### Task 5 — API: Year detail route and period CRUD routes
**Depends on:** Task 3 (extended mutations)
**Files to create:**
- `src/app/api/academy/calendar/years/[id]/route.ts` (GET year with its periods)
- `src/app/api/academy/calendar/years/[id]/periods/route.ts` (POST create period)
- `src/app/api/academy/calendar/years/[id]/periods/[periodId]/route.ts` (PATCH, DELETE)
- `src/app/api/academy/calendar/years/[id]/periods/[periodId]/status/route.ts` (PATCH status)

**GET /api/academy/calendar/years/[id]**
- Fetches year by ID (tenant-scoped), fetches all periods for that year
- Returns `{ year, periods }`
- 404 if year not found

**POST /api/academy/calendar/years/[id]/periods**
- Body: `{ name, code, periodType, startsOn, endsOn, sequence }`
- Calls `createTerm(actor, { academicYearId: id, ...body }, client)`
- Returns `{ period, warnings }`
- 400 validation, 409 conflict, 403 auth

**PATCH /api/academy/calendar/years/[id]/periods/[periodId]**
- Body: partial `{ name?, code?, periodType?, startsOn?, endsOn?, sequence? }`
- Calls `updateTerm(actor, periodId, body, false, client)`
- Returns `{ period, warnings }`

**PATCH /api/academy/calendar/years/[id]/periods/[periodId]/status**
- Body: `{ action: "open_enrollment" | "activate" | "complete" | "archive" }`
- Maps action to state: open_enrollment→enrollment_open, activate→active, complete→completed, archive→archived
- Calls `transitionTermState(actor, periodId, newState, client)`
- Returns `{ period }`

**DELETE /api/academy/calendar/years/[id]/periods/[periodId]**
- Calls `deleteTerm(actor, periodId, client)` (checks no enrollments)
- Returns `{}`
- 409 if blocking enrollments

**Success condition:** Routes callable via curl or fetch. Auth required. Wrong tenant returns 403.

---

### Task 6 — API: User context routes
**Depends on:** Task 4 (user-context repository)
**Files to create:**
- `src/app/api/academy/user-context/route.ts`

**GET /api/academy/user-context**
```typescript
export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      return resolveAcademicContext(actor.userId, actor.tenantId, client);
    });
  });
}
```

**PUT /api/academy/user-context**
```typescript
export async function PUT(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as { activeYearId?: string | null; activePeriodId?: string | null };
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      // If yearId changes, clear periodId
      const yearId = body.activeYearId !== undefined ? body.activeYearId : undefined;
      const periodId = yearId !== undefined ? null : body.activePeriodId ?? null;
      await saveAcademicContext(actor.userId, actor.tenantId, yearId ?? null, periodId, client);
      return resolveAcademicContext(actor.userId, actor.tenantId, client);
    });
  });
}
```

**Success condition:** GET returns context. PUT saves context and GET returns updated value.
Cross-user isolation verified.

---

### Task 7 — API: Course catalog edits (delete route, archive/activate via PATCH)
**Depends on:** existing course mutations (no new mutation work needed)
**Files to modify:**
- `src/app/api/academy/courses/[id]/route.ts` — add DELETE handler

**What to add:**
```typescript
export async function DELETE(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      // Only draft courses with no sections can be deleted
      const course = await client.query(
        `select status from academy_courses where tenant_id = $1 and id = $2`,
        [actor.tenantId, id]
      );
      if (!course.rowCount) throw new Error("Course not found.");
      if (course.rows[0].status !== "draft") throw new Error("Only draft courses can be deleted.");
      const sections = await client.query(
        `select count(*) as cnt from academy_course_sections where tenant_id = $1 and course_id = $2`,
        [actor.tenantId, id]
      );
      if (Number(sections.rows[0].cnt) > 0) {
        throw new AcademyConflictError("Cannot delete course with existing sections.");
      }
      await client.query(`delete from academy_courses where tenant_id = $1 and id = $2`, [actor.tenantId, id]);
      return {};
    });
  });
}
```

The existing PATCH route already handles `status` field for activate and archive — verify it
passes `status` to `updateCourse` correctly. The `updateCourse` mutation handles `draft→active`
via `activateCourse` and `active→archived` via `archiveCourse`. If the PATCH route does not
delegate to those specialized functions, update it to do so.

**Success condition:** DELETE returns 200 for draft course, 400 for non-draft, 409 for course with sections.

---

### Task 8 — API: Program management (archive, delete routes)
**Depends on:** existing program repository (`src/modules/academic-programs/postgres-repository.ts`)
**Files to modify:**
- `src/modules/academic-programs/postgres-repository.ts` — add `archive` and `delete` methods
- `src/app/api/academy/programs/[id]/route.ts` — add DELETE handler

**`archive` method:**
```typescript
async archive(tenantId: string, id: string): Promise<AcademicProgram> {
  const result = await this.db.query(
    `update academy_academic_programs set status = 'archived', updated_at = now()
     where tenant_id = $1 and id::text = $2 returning *`,
    [tenantId, id]
  );
  if (!result.rows[0]) throw new Error(`Program ${id} not found.`);
  return mapProgramRow(result.rows[0]);
}
```

**`delete` method:**
```typescript
async delete(tenantId: string, id: string): Promise<void> {
  const enrollments = await this.db.query(
    `select count(*) as cnt from academy_program_enrollments where tenant_id = $1 and program_id::text = $2`,
    [tenantId, id]
  );
  if (Number(enrollments.rows[0].cnt) > 0) {
    throw new AcademyConflictError("Cannot delete program with existing student enrollments.");
  }
  await this.db.query(
    `delete from academy_academic_programs where tenant_id = $1 and id::text = $2`,
    [tenantId, id]
  );
}
```

Note: `academy_academic_programs.id` is UUID; `id` param is text. Cast `id::text = $2` or use
`id = $2::uuid`. Check existing repo for the pattern used.

The existing PATCH route for programs accepts `status` — verify it calls `archive` when
`status = "archived"`.

**DELETE /api/academy/programs/[id]:**
- Calls `repo.delete(tenantId, id)`
- Returns `{}`
- 409 if enrollments exist

**Success condition:** Archive sets status to `archived`. Delete works for programs with no
enrollments. 409 returned for programs with enrollments.

---

### Task 9 — Frontend: Academic Year detail page with inline period management
**Depends on:** Task 5 (year + period API routes)
**Files to create:**
- `src/app/admin/settings/calendar/years/[id]/page.tsx`
- `src/app/admin/settings/calendar/years/[id]/YearDetailClient.tsx`
- `src/app/admin/settings/calendar/years/[id]/CreatePeriodDialog.tsx`
- `src/app/admin/settings/calendar/years/[id]/EditPeriodDialog.tsx`
- `src/app/admin/settings/calendar/years/[id]/PeriodRowActions.tsx`

**Files to modify:**
- `src/app/admin/settings/calendar/CalendarClient.tsx` — add year name Links
- `src/app/globals.css` — add `.period-overlap-warning` class

**Page structure:**

`page.tsx` (server component):
```typescript
export default async function YearDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const { year, periods } = await withAcademyDatabaseContext(actor, async (client) => {
    // fetch year by id (tenant-scoped), fetch periods for this year
  });
  return (
    <AdminShell eyebrow="Settings / Calendar" title={year.name} activeSection="system">
      <YearDetailClient year={year} periods={periods} />
    </AdminShell>
  );
}
```

`YearDetailClient.tsx` renders:
1. Year info card (name, code, dates, status, calendar system) — read-only with "Edit" button (placeholder for inline edit, deferred to task refinement — show as static display in Phase 1).
2. A "Periods" card with:
   - Table: Name, Code, Type, Start, End, Sequence, Status, Actions
   - "Add Period" button → `CreatePeriodDialog`
   - Each row: `PeriodRowActions` dropdown

`CreatePeriodDialog.tsx`:
- Fields: Name, Code, Period Type (Select with: Semester/Term, Quarter/Session, Module, Intensive), Start Date, End Date, Sequence (number input)
- POST to `/api/academy/calendar/years/[id]/periods`
- On 200 success: if `warnings.length > 0`, show `.period-overlap-warning` banner with warning message; close dialog on user dismiss
- On 200 success with no warnings: close dialog immediately
- On error: show notifyAcademy error

`EditPeriodDialog.tsx`:
- Same fields, pre-populated with period values
- PATCH to `/api/academy/calendar/years/[id]/periods/[periodId]`
- Same warning + error handling as create

`PeriodRowActions.tsx` (dropdown):
- Edit → opens EditPeriodDialog
- Open Enrollment (if planned)
- Activate (if enrollment_open)
- Complete (if active) — with confirmation dialog requiring period name
- Archive (if completed)
- Delete (if planned, no sections) — AlertDialog confirmation

`CalendarClient.tsx` — update the Academic Years tab table:
- Year name cell: `<Link href={`/admin/settings/calendar/years/${year.id}`}>{year.name}</Link>`

**Success condition:** Admin can navigate to `/admin/settings/calendar/years/[id]`, see the year
and its periods, create a new period with all six fields, edit a period, and transition a period
through its lifecycle states — all without a dead end or 404.

---

### Task 10 — Frontend: Academic Year + Period Context Picker
**Depends on:** Task 6 (user-context API routes)
**Files to create:**
- `src/components/AcademicContextPicker.tsx`
- `src/app/admin/layout.tsx` (new or extend if exists)
**Files to modify:**
- `src/components/admin-shell.tsx` — add `academicContext` and `academicContextOptions` props, replace cookie-based period selector with `AcademicContextPicker`
- `src/app/globals.css` — add `.admin-context-picker`, `.admin-context-picker-select`, `.admin-context-picker-divider`

**`AcademicContextPicker.tsx`:**
```typescript
"use client";
interface Props {
  initialContext: AcademicContextRow;
  options: AcademicContextOptions;
}
export function AcademicContextPicker({ initialContext, options }: Props) {
  const router = useRouter();
  const [yearId, setYearId] = useState(initialContext.activeYearId);
  const [periodId, setPeriodId] = useState(initialContext.activePeriodId);

  const currentPeriods = yearId ? (options.periodsByYear[yearId] ?? []) : [];

  async function handleYearChange(newYearId: string) {
    setYearId(newYearId);
    setPeriodId(null);
    await fetch("/api/academy/user-context", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeYearId: newYearId, activePeriodId: null }),
    });
    router.refresh();
  }

  async function handlePeriodChange(newPeriodId: string) {
    setPeriodId(newPeriodId);
    await fetch("/api/academy/user-context", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activePeriodId: newPeriodId }),
    });
    router.refresh();
  }

  return (
    <div className="admin-context-picker">
      <select
        className="admin-context-picker-select"
        value={yearId ?? ""}
        onChange={(e) => handleYearChange(e.target.value)}
        aria-label="Select Academic Year"
      >
        {options.years.map((y) => (
          <option key={y.id} value={y.id}>{y.name}</option>
        ))}
      </select>
      {currentPeriods.length > 0 && (
        <>
          <span className="admin-context-picker-divider">›</span>
          <select
            className="admin-context-picker-select"
            value={periodId ?? ""}
            onChange={(e) => handlePeriodChange(e.target.value)}
            aria-label="Select Academic Period"
          >
            <option value="">All Periods</option>
            {currentPeriods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
```

**Admin layout (`src/app/admin/layout.tsx`):**
```typescript
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    const actor = await requireActor();
    const { context, options } = await withAcademyDatabaseContext(actor, (client) =>
      resolveAcademicContext(actor.userId, actor.tenantId, client)
    );
    return (
      <AcademicContextInjector context={context} options={options}>
        {children}
      </AcademicContextInjector>
    );
  } catch {
    // Not authenticated — let the page handle redirect
    return <>{children}</>;
  }
}
```

Note: If the admin shell is rendered in many places with different props, the cleanest approach
is to pass `academicContext` and `academicContextOptions` as props from each page's server
component into `AdminShell`. The layout approach consolidates this. Choose the one that fits
the existing shell usage pattern — check if `AdminShell` is used in a consistent wrapper.

**AdminShell changes:**
- Remove `useEffect` that fetches `/api/academy/calendar/periods` and the cookie read/write.
- Remove the existing period `<select>` in the topbar.
- If `academicContext` and `academicContextOptions` props are present, render
  `<AcademicContextPicker initialContext={academicContext} options={academicContextOptions} />`
  in the topbar where the old selector was.

**Success condition:** Admin can see both a year selector and a period selector in the topbar.
Changing the year updates the period options. Selection persists after browser close. Different
users on the same tenant have independent context selections.

---

### Task 11 — Frontend: Course Catalog create/edit/archive UI
**Depends on:** Task 7 (course DELETE API)
**Files to create:**
- `src/app/admin/courses/CourseFormDialog.tsx`
- `src/app/admin/courses/CourseRowActions.tsx`
**Files to modify:**
- `src/app/admin/courses/course-actions.tsx` — replace `NewCourseButton` with a wrapper that uses `CourseFormDialog`
- `src/app/admin/courses/page.tsx` — add `CourseRowActions` to each course row

**`CourseFormDialog.tsx`:**
- Accepts optional `initialCourse?: Course` — if provided, renders in edit mode
- Fields:
  - Title (Input, required)
  - Code (Input, required, auto-uppercase on blur)
  - Course Type (Select: bible_course, general_education, major_requirement, elective, seminary_course, ministry_practicum, lab, children_class, chapel, custom)
  - Course Level (Select: children, certificate, undergraduate, graduate, continuing_education)
  - Credit Hours (number input, optional)
  - Clock Hours (number input, optional)
  - Description (Textarea, optional)
- POST to `/api/academy/courses` (create) or PATCH to `/api/academy/courses/[id]` (edit)
- On success: `notifyAcademy` success + `router.refresh()` + close dialog

**`CourseRowActions.tsx`:**
- Dropdown: Edit (opens CourseFormDialog), Activate (if draft), Archive (if active), Delete (if draft)
- Archive: AlertDialog → PATCH `{ status: "archived" }`
- Activate: PATCH `{ status: "active" }`
- Delete: AlertDialog → DELETE `/api/academy/courses/[id]`
- All mutations: `notifyAcademy` on success/error + `router.refresh()`

**`course-actions.tsx` update:**
- `NewCourseButton` renders `<CourseFormDialog />` (no initialCourse)

**`page.tsx` update:**
- Courses table adds final column "Actions" with `<CourseRowActions course={course} />`

**Success condition:** Admin can create a course with all fields, edit a course, archive an
active course, activate a draft course, and delete a draft course — all without a 404 or dead end.
Archived courses display in the list with a destructive badge. Active courses show a green badge.

---

### Task 12 — Frontend: Program Management create/edit/archive/detail UI
**Depends on:** Task 8 (program archive/delete API)
**Files to create:**
- `src/app/admin/programs/[id]/page.tsx`
- `src/app/admin/programs/[id]/ProgramDetailClient.tsx`
- `src/app/admin/programs/ProgramRowActions.tsx`
**Files to modify:**
- `src/components/program-create-form.tsx` — add `initialValues` prop for edit mode
- `src/app/admin/programs/page.tsx` — add `ProgramRowActions` to each row, link program names
- `src/app/admin/programs/new/page.tsx` — no change needed

**`program-create-form.tsx` update:**
- Accept optional `initialValues?: Partial<AcademicProgram>` prop
- If provided, pre-populate fields and POST to PATCH `/api/academy/programs/[id]` instead of POST

**`src/app/admin/programs/[id]/page.tsx`:**
```typescript
export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const program = await withAcademyDatabaseContext(actor, (client) =>
    new PostgresAcademicProgramRepository(asAcademyDatabase(client)).findById(actor.tenantId, id)
  );
  if (!program) notFound();
  return (
    <AdminShell eyebrow="Programs" title={program.title} activeSection="academics">
      <ProgramDetailClient program={program} />
    </AdminShell>
  );
}
```

**`ProgramDetailClient.tsx`:**
- Shows program info card (all fields, read-only)
- "Edit" button → opens `program-create-form.tsx` in edit mode via dialog
- "Archive" button (if status = active/draft) → AlertDialog → PATCH `{ status: "archived" }`
- Status badge showing current status

**`ProgramRowActions.tsx`:**
- Edit → navigates to `/admin/programs/[id]` (or opens edit dialog)
- Archive (if active/draft) → AlertDialog → PATCH
- Delete (if draft, no enrollments) → AlertDialog → DELETE

**`programs/page.tsx` update:**
- Program name cell: `<Link href={`/admin/programs/${program.id}`}>{program.name}</Link>`
- Final column: `<ProgramRowActions program={program} />`

**Success condition:** Admin can navigate from the program index to a program detail page. They
can create a program, edit it, archive it. The status is visible as a badge. "Delete" appears
only for draft programs.

---

### Task 13 — Integration: Remove cookie-based period selector
**Depends on:** Task 10 (context picker UI)
**Files to modify:**
- `src/components/admin-shell.tsx` — remove all cookie read/write/useEffect for `academic_period_id`
- Any page that reads `cookies().get("academic_period_id")` — update to use context from
  `resolveAcademicContext` instead

**Files to check:**
```bash
grep -r "academic_period_id" src/
```

Replace every `cookieStore.get("academic_period_id")?.value` call in server components with
the resolved `activePeriodId` from the `academy_user_context` table (via `resolveAcademicContext`
or via context passed from layout).

**Success condition:** No references to `academic_period_id` cookie remain in the codebase.
Period filtering in `/admin/courses/page.tsx` and similar pages uses DB-persisted context.

---

### Task 14 — Tests: Period mutations (expanded)
**Depends on:** Task 3 (extended mutations)
**Files to modify/create:**
- `src/modules/academic-calendar/__tests__/mutations.test.ts`

**Required test cases:**
- `createTerm` with periodType = "session" saves correctly
- `createTerm` with overlap → returns `{ period, warnings: [{ code: "DATE_OVERLAP" }] }`
- `createTerm` with duplicate sequence → throws AcademyConflictError
- `createTerm` with dates outside year → throws Error
- `updateTerm` cross-tenant → throws not found
- `archiveTerm` with enrollments → `{ success: false, blockingRecords: N }`
- `archiveTerm` without enrollments → `{ success: true }`

All test data must be created through real module functions — no raw SQL inserts.

**Success condition:** `npm test` passes with all cases described above.

---

### Task 15 — Tests: User context, program archive/delete
**Depends on:** Tasks 4, 8
**Files to create:**
- `src/modules/academic-calendar/__tests__/user-context-repository.test.ts`
- `src/modules/academic-programs/__tests__/repository.test.ts` (extend)

**User context test cases:**
- No saved context: resolves to active year + active period
- Saved context: returns saved values
- Cross-tenant: options only include current tenant's years

**Program tests:**
- `archive`: program status becomes archived
- `archive` cross-tenant: not found
- `delete` with no enrollments: succeeds
- `delete` with enrollments: throws AcademyConflictError

**Success condition:** `npm test` passes with all above cases.

---

### Task 16 — Final verification
**Depends on:** all preceding tasks
**Commands to run:**
```bash
npm test
npm run lint
npm run build
```

**Browser walkthrough required:**
1. Log in as admin. Confirm context picker shows in topbar with year and period selects.
2. Change year → period select updates. Change period → context persists after refresh.
3. Navigate to Settings → Calendar. Click a year name → year detail page loads.
4. Add a period with all fields. Confirm it appears in the period list.
5. Edit the period. Confirm changes save.
6. Transition period through Open Enrollment → Active. Confirm status updates.
7. Navigate to Academics → Course Catalog. Click "Create Course" with all fields. Confirm course appears.
8. Archive the course. Confirm badge changes. Activate it again.
9. Navigate to Programs. Create a new program. Confirm it appears in the list.
10. Click a program name → program detail page loads.
11. Edit the program. Archive the program. Confirm status badge.

**Success condition:** All 16 tasks complete. `npm test`, `npm run lint`, `npm run build` all pass.
Browser walkthrough completes without a 404, dead end, or missing action.
