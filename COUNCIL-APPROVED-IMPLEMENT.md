# Graduation Clearance Workflow — Council-Approved Implementation Plan

**Status:** COMPLETED / SUPERSEDED — retained for historical implementation context
**Closed by:** PR #155, as recorded by `docs/reports/mvp-and-competitive-status-2026-09-25.md`
**Approved:** 2026-09-22 (4/4 council voices)  
**Phase alignment:** Roadmap Phase 14, Sprint 5 — "formation release policy and graduation readiness integration"  
**Scope guard:** This plan covers ONLY the per-student graduation clearance record and its admin UI.
It does NOT cover: ceremony management, diploma printing, official final transcript
issuance automation, FERPA-release notifications, or degree conferral letters.
Those are separate future work packages. Stay in this boundary.

## Context

Current status: the Graduation audit + clearance workflow is working as of the latest MVP and competitive evaluation. Do not treat this file as an active open plan. Use `docs/development-guide.md` for the active MVP and competitive implementation backlog.

The graduation audit page (`/admin/graduation`) already identifies which students are near
or above the credit threshold, shows formation completion status, and flags holds. However,
there is currently no structured way for a registrar to:
- Formally initiate a graduation clearance review for a specific student
- Record a clearance decision (cleared vs. deferred) with notes
- Track who cleared whom and when (audit trail)
- See clearance status alongside a student's full detail record

This plan adds those capabilities as a thin, well-gated domain object following the same
action-with-audit-event pattern already used for admissions decisions and document waivers.

## Council Vote Record

| Voice | Vote | Rationale |
|-------|------|-----------|
| Product | APPROVE | Closes the workflow loop: audit page shows candidates but has no in-product next step; Phase 14 sprint 5 alignment |
| Engineering | APPROVE | Follows existing patterns; service + 2 routes + 1 UI card; 2-3 days scope |
| Design/UX | APPROVE | Coherent with admissions decision and waiver patterns; student detail page is the right home |
| Risk | APPROVE | Admin-only; role-gated; main risk is scope creep — plan scope guard addresses it |

---

## Prompt 1 — Module Foundation: Migration, Types, Repository, Service, Tests

**Branch:** `feature/graduation-clearance-workflow` (this plan lives on this branch; all implementation
work also goes on this branch unless CLAUDE.md instructs otherwise)

### 1a. Migration

Create `supabase/migrations/<timestamp>_graduation_clearance.sql` (use current UTC timestamp
in the filename, e.g. `20260922140000_graduation_clearance.sql`).

Table definition:

```sql
create type academy_graduation_clearance_status as enum ('pending', 'cleared', 'deferred');

create table academy_graduation_clearances (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references academy_tenants(id) on delete cascade,
  student_profile_id    uuid not null references academy_student_profiles(id) on delete cascade,
  academic_program_id   uuid not null references academy_academic_programs(id),
  academic_year_id      uuid not null references academy_academic_years(id),
  status                academy_graduation_clearance_status not null default 'pending',
  initiated_by_person_id uuid not null references academy_people(id),
  initiated_at          timestamptz not null default now(),
  cleared_by_person_id  uuid references academy_people(id),
  cleared_at            timestamptz,
  deferred_reason       text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(tenant_id, student_profile_id, academic_program_id, academic_year_id)
);

alter table academy_graduation_clearances enable row level security;

-- Read: same staff roles that can read the graduation audit page
create policy "Clearances readable by graduation-review roles"
  on academy_graduation_clearances for select
  using (
    tenant_id = (select tenant_id from academy_people where id = auth.uid())
    and exists (
      select 1 from academy_person_roles r
       where r.person_id = auth.uid()
         and r.role in ('institution_admin','dean','registrar','academic_admin')
         and (r.expires_at is null or r.expires_at > now())
    )
  );

-- Write: same roles
create policy "Clearances writable by graduation-review roles"
  on academy_graduation_clearances for all
  using (
    tenant_id = (select tenant_id from academy_people where id = auth.uid())
    and exists (
      select 1 from academy_person_roles r
       where r.person_id = auth.uid()
         and r.role in ('institution_admin','dean','registrar','academic_admin')
         and (r.expires_at is null or r.expires_at > now())
    )
  )
  with check (
    tenant_id = (select tenant_id from academy_people where id = auth.uid())
  );
```

### 1b. Types

Create `src/modules/graduation/types.ts`:

```typescript
export type GraduationClearanceStatus = "pending" | "cleared" | "deferred";

export interface GraduationClearance {
  id: string;
  tenantId: string;
  studentProfileId: string;
  academicProgramId: string;
  academicYearId: string;
  status: GraduationClearanceStatus;
  initiatedByPersonId: string;
  initiatedAt: string;
  clearedByPersonId?: string;
  clearedAt?: string;
  deferredReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InitiateClearanceInput {
  studentProfileId: string;
  academicProgramId: string;
  academicYearId: string;
}

export interface UpdateClearanceInput {
  clearanceId: string;
  action: "clear" | "defer";
  notes?: string;
  deferredReason?: string;
}

export interface GraduationClearanceRepository {
  create(tenantId: string, initiatedByPersonId: string, input: InitiateClearanceInput): Promise<GraduationClearance>;
  update(tenantId: string, clearedByPersonId: string, input: UpdateClearanceInput): Promise<GraduationClearance>;
  findByStudent(tenantId: string, studentProfileId: string): Promise<GraduationClearance | undefined>;
}
```

### 1c. Repository

Create `src/modules/graduation/postgres-repository.ts` — implement the three methods above
using parameterized queries against `academy_graduation_clearances`. Follow the same query
pattern used in `src/modules/admissions/postgres-repository.ts`. Map snake_case rows to
camelCase types. Include the database interface type (`GraduationDatabase`) so the page can
compose it at the `StudentPageDatabase` union.

### 1d. Service

Create `src/modules/graduation/service.ts`:

```typescript
// allowed roles: institution_admin, dean, registrar, academic_admin
export class GraduationClearanceService {
  constructor(private readonly repo: GraduationClearanceRepository) {}

  async initiate(actor: AcademyActor, input: InitiateClearanceInput): Promise<GraduationClearance>
  async update(actor: AcademyActor, input: UpdateClearanceInput): Promise<GraduationClearance>
  async getForStudent(actor: AcademyActor, studentProfileId: string): Promise<GraduationClearance | undefined>
}
```

`initiate` must reject if a non-deferred clearance already exists for the same student +
program + year (409 conflict; wrap in a domain error type). `update` must validate the
`action`/`deferredReason` combination — `defer` without a `deferredReason` is rejected.
Every method rejects any actor whose tenantId does not match the record's tenantId (cross-tenant guard).

### 1e. Tests

Create `src/modules/graduation/__tests__/graduation-clearance.test.ts` following the
`node:test` + `node:assert/strict` conventions in CLAUDE.md.

Required cases:
1. `initiate` — success: creates a pending clearance and returns it
2. `initiate` — idempotency guard: second call for same student/program/year throws a known error
3. `update clear` — success: transitions pending → cleared, sets cleared_at and cleared_by
4. `update defer` — success: transitions pending → deferred, requires deferredReason
5. `update defer` — validation: missing deferredReason throws
6. Cross-tenant rejection: `getForStudent`, `initiate`, and `update` all throw when
   actor.tenantId does not match
7. Role rejection: call from a student or faculty role is rejected

Run `npm test` (on macOS host — this cannot pass in the Linux VM due to platform mismatch).
Run `npx tsc --noEmit` and `npm run lint` — both must be clean before committing.

**Commit message format:**
```
feat: graduation clearance module — migration, types, repository, service, tests

Adds academy_graduation_clearances table with RLS, GraduationClearanceService
(initiate / update / getForStudent), and full node:test coverage for the
Graduation Clearance Workflow (council-approved 2026-09-22, Phase 14 sprint 5).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YX7DQfVAciZFMk7mcrBp66
```

---

## Prompt 2 — API Routes

Create two route files under `src/app/api/academy/graduation/`:

### POST `/api/academy/graduation/clearances`
Body: `{ studentProfileId, academicProgramId, academicYearId }`  
Returns: `GraduationClearance` (201)  
Errors: 409 if already initiated, 403 if wrong role, 400 on validation failure

### PATCH `/api/academy/graduation/clearances/[clearanceId]`
Body: `{ action: "clear" | "defer", notes?: string, deferredReason?: string }`  
Returns: updated `GraduationClearance` (200)  
Errors: 404 if not found (wrong tenant), 400 if defer without reason, 409 if already cleared

### GET `/api/academy/graduation/clearances?studentId=<uuid>`
Returns: `GraduationClearance | null` (200)

All routes must:
- Call `requireActor` and check roles (institution_admin / dean / registrar / academic_admin)
- Use `withAcademyDatabaseContext` for DB access
- Return database error messages as generic 500, never raw SQL errors
- Follow the thin-route pattern: resolve actor → call service → map errors → return JSON

Run `npx tsc --noEmit` and `npm run lint` clean before committing.

**Commit message format:**
```
feat: graduation clearance API routes (POST, PATCH, GET)

Adds three role-gated routes for the graduation clearance workflow: initiate,
update (clear/defer), and student lookup. Follows thin-route pattern.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YX7DQfVAciZFMk7mcrBp66
```

---

## Prompt 3 — Admin UI

### 3a. GraduationClearanceCard on Student Detail Page

Create `src/app/admin/students/[id]/GraduationClearanceCard.tsx` as a **client component**.

Display:
- If no clearance: "Graduation clearance not yet initiated" + "Initiate Clearance Review" button
  (only shown to registrar / dean / institution_admin / academic_admin)
- If pending: show who initiated it and when; show "Clear for Graduation" button and "Defer" button
  (defer requires a reason via a small inline form or dialog — a simple `<textarea>` is fine,
  no modal library needed)
- If cleared: show cleared-by person name and timestamp, status badge (variant="secondary")
- If deferred: show deferred reason, status badge (variant="destructive"), and "Re-initiate"
  option so a new clearance can be started after corrective action

The card must POST / PATCH via `fetch` to the routes from Prompt 2 and refresh the display
on success. No global state — local `useState` is fine.

### 3b. Wire card into student detail page

In `src/app/admin/students/[id]/page.tsx`:
1. Add `GraduationDatabase` to the `StudentPageDatabase` union type
2. Fetch `new GraduationClearanceService(graduationRepo).getForStudent(actor, id)` alongside
   the other parallel data fetches
3. Render `<GraduationClearanceCard clearance={graduationClearance} studentId={id} />` inside
   the "Academic Record" `TabsContent`, below the existing `<StudentProgramProgressCard />`.

### 3c. Graduation audit page badge

In `src/app/admin/graduation/page.tsx`, add a `Clearance` column to `CandidateTable`.
Fetch all clearances for the listed students using a single query
(`select * from academy_graduation_clearances where tenant_id = $1 and student_profile_id = any($2::uuid[])`)
and merge them into the candidate rows. Show a small badge: "Cleared" (secondary), "Pending"
(outline), "Deferred" (destructive), or "—" (not initiated).

**Commit message format:**
```
feat: graduation clearance admin UI — student detail card and audit page badge

Adds GraduationClearanceCard to student detail page (Academic Record tab) and
a clearance-status badge to the graduation audit table. Provides registrars a
full in-product graduation clearance workflow.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YX7DQfVAciZFMk7mcrBp66
```

---

## Prompt 4 — Verification

Run the full gate on the macOS host:
```
npm test && npm run lint && npm run build
```

- `npm test` must show all tests passing (zero regressions + new graduation clearance tests pass)
- `npm run lint` must be clean
- `npm run build` must complete without TypeScript errors

If any failures appear, fix them before proceeding.

Open the graduation audit page (`/admin/graduation`) and the student detail page
(`/admin/students/[id]`) in a browser and verify:
1. "Academic Record" tab shows `GraduationClearanceCard` below `StudentProgramProgressCard`
2. Initiating a clearance creates a pending record and the card updates
3. Clearing sets status to "Cleared" with actor name and timestamp
4. Deferring requires a reason and sets status to "Deferred"
5. Graduation audit table shows clearance status badges

Push the branch and open a PR with `gh pr create`:
- Title: `feat: graduation clearance workflow (council-approved 2026-09-22, Phase 14 sprint 5)`
- Body: summarise the four prompts, include council vote table, reference this plan file,
  note that `npm run verify` was run and passed

**Do not merge the PR** — @ricardojjulia reviews and merges.

---

## Post-merge: update this file

After the PR is merged to main, add `Status: SHIPPED` at the top of this file and commit
that change directly on main (or as part of the merge squash). The daily loop will then
treat this plan as complete.
