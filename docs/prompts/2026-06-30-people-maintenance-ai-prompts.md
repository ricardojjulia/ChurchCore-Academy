# AI Worker Prompts: People Maintenance System

Date: 2026-06-30
Factory session: Council Review IV — People Maintenance
Design spec: `docs/superpowers/specs/2026-06-30-people-maintenance-design.md`
Implementation plan: `docs/superpowers/plans/2026-06-30-people-maintenance.md`
ADRs: `docs/adr/0062-people-maintenance-architecture.md`, `docs/adr/0063-covenant-record-spiritual-profile-model.md`
Council review: `docs/reviews/council-review-4-people-maintenance.md`

---

## Prompt 1 — Council Review Worker

You are the Council Review Worker for ChurchCore Academy. Your job is to verify the people maintenance design before any code is written. You must read files and report only — do not edit any source files.

**Your task:**

Read all of the following files and verify the design is complete and internally consistent:

1. `docs/reviews/council-review-4-people-maintenance.md` — council findings
2. `docs/adr/0062-people-maintenance-architecture.md` — architecture decision
3. `docs/adr/0063-covenant-record-spiritual-profile-model.md` — covenant record decision
4. `docs/superpowers/specs/2026-06-30-people-maintenance-design.md` — full design spec
5. `docs/superpowers/plans/2026-06-30-people-maintenance.md` — implementation plan
6. `src/modules/people/types.ts` — existing types
7. `src/modules/people/access-policy.ts` — existing access policy
8. `src/modules/people/validation.ts` — existing validation
9. `src/modules/people/student-record-mutations.ts` — existing mutations (pattern reference)
10. `src/modules/academy-auth/policy.ts` — role definitions
11. `src/modules/academy-config/types.ts` — institution config types

**Verify:**
1. Every person type in the design spec has a complete API endpoint table (GET list, GET detail, mutations)
2. Every API endpoint has a corresponding module function in the implementation plan
3. Every new module function has tests specified (success, validation, cross-tenant)
4. The role sets in ADR-0062 are consistent with `AcademyRole` in `src/modules/academy-auth/policy.ts`
5. No new API route uses `/api/academy/` namespace (admin routes must use `/api/admin/`)
6. The `PeopleAccessAction` additions in Task 1.1 cover all new write actions described in the spec
7. The `CovenantRecord` type additions are compatible with existing `types.ts` structure
8. `InstitutionCapabilitySet` in `src/modules/academy-config/types.ts` can accept a `covenantRecords: boolean` field
9. There are no conflicts between new file paths and existing files (check `src/app/admin/people/` does not already exist)
10. The implementation plan tasks are in dependency order (policy before mutations, mutations before routes, routes before UI)

**Report format:**
- PASS / FAIL for each verification item
- For FAILs: describe exactly what is inconsistent and which files are in conflict
- Final verdict: READY TO BUILD or NEEDS REVISION

---

## Prompt 2 — Backend Infrastructure Worker

You are the Backend Infrastructure Worker for ChurchCore Academy. You are implementing Phase 1 of the people maintenance system.

**Read first:**
- `CLAUDE.md` — architecture rules (mandatory)
- `docs/adr/0062-people-maintenance-architecture.md` — architecture decisions you must follow
- `src/modules/people/access-policy.ts` — extend this file
- `src/modules/people/student-record-mutations.ts` — your pattern reference for all new mutation files
- `src/modules/people/types.ts` — types you will use
- `src/modules/people/validation.ts` — validation helpers you can reuse
- `src/modules/academy-auth/policy.ts` — role definitions
- `docs/superpowers/plans/2026-06-30-people-maintenance.md` — Tasks 1.1 through 1.7

**Your deliverables (Phase 1 tasks 1.1 through 1.5 + 1.6):**

**Task 1.1:** Extend `src/modules/people/access-policy.ts`:
- Add to `PeopleAccessAction`: `"write_person" | "write_staff" | "write_guardian" | "write_relationship" | "read_applicant" | "write_applicant" | "read_advisor_load"`
- Add new role sets with the exact membership defined in ADR-0062 Task 1.1
- Add cases for each new action to the `canAccessPeopleDomain` switch statement

**Task 1.2:** Create `src/modules/people/person-mutations.ts` with `createPerson`, `updatePersonFields`, `archivePerson`. Follow the pattern in `student-record-mutations.ts` exactly: assertTenantIsolation, role assertion, verify target exists, build dynamic SET clause, emitAuditEvent per changed field, SHA-256 hash for sensitive old values (email, phone, date_of_birth, given_name, family_name, display_name).

**Task 1.3:** Create `src/modules/people/staff-mutations.ts` with `createStaffProfile`, `updateStaffProfile`, `deactivateStaff`. Staff number format: `STF-` + 6-digit zero-padded sequential number from a count query. Same pattern as Task 1.2.

**Task 1.4:** Create `src/modules/people/relationship-mutations.ts` with `createStudentRelationship`, `updateStudentRelationship`, `deactivateStudentRelationship`. Re-apply the validation rules from `validation.ts::validateRelationship`. Emit audit events. SHA-256 hash old authority and visibility values on update.

**Task 1.5:** Create `src/modules/people/guardian-mutations.ts` with `createGuardianWithLink`. This function calls the person insert logic (from Task 1.2 pattern) then the relationship insert (from Task 1.4 pattern), then inserts a role assignment row for `guardian` role scoped to the student. All three inserts must succeed or emit an error.

**Task 1.6:** Create `src/app/api/admin/people/[id]/route.ts` with PATCH (updatePersonFields) and DELETE (archivePerson). Follow the thin route pattern — no business logic in the handler.

**Tests:** Add to `src/modules/people/__tests__/`:
- `access-policy.test.ts` — test all new actions
- `person-mutations.test.ts` — success, validation, cross-tenant for each function
- `staff-mutations.test.ts` — success, validation, cross-tenant
- `relationship-mutations.test.ts` — success, all validation rejection cases, cross-tenant
- `guardian-mutations.test.ts` — success, invalid type rejection, cross-tenant
- All tests use `node:test` + `node:assert/strict`. No Jest.
- In every test file: use `assert.doesNotMatch(JSON.stringify(result), /credentialSecret|accessToken|refreshToken|password/)` to verify secret fields are absent from output

**Verification:** After completing all tasks: `npm test && npm run lint && npm run build`. Fix any errors before returning. Report what you built and what tests pass.

**Do not:** Edit any frontend files, any migration files, or any existing module files beyond `access-policy.ts`. Do not create migrations.

---

## Prompt 3 — Student Profile Worker

You are the Student Profile Frontend Worker for ChurchCore Academy. You are implementing Phase 2 Task 2.2 — the Student Detail Panel.

**Read first:**
- `CLAUDE.md` — architecture rules (mandatory)
- `docs/superpowers/specs/2026-06-30-people-maintenance-design.md` — the "Person Type: Student" section and "People Hub Navigation" section
- `docs/superpowers/plans/2026-06-30-people-maintenance.md` — Tasks 2.1 and 2.2
- `src/app/admin/students/[id]/page.tsx` — existing student detail page (pattern reference for data loading)
- `src/app/admin/students/page.tsx` — pattern reference for student list
- `src/app/admin/settings/people/page.tsx` — existing people page structure
- `src/modules/people/types.ts` — types
- `src/modules/people/access-policy.ts` — access policy (post Task 1.1 update)

**Assume:** Phase 1 (Tasks 1.1–1.7) has been completed. The API routes exist and work correctly. Do not re-implement API routes.

**Your deliverables:**

1. Create `src/app/admin/people/page.tsx` — the People Hub with tabbed navigation. Overview tab shows existing `PeopleMetricTiles` and validation content. Other tabs show a metric summary card + "View all" link + "+ New" button. This is a Server Component.

2. Create `src/app/admin/people/students/page.tsx` — Student list page. Server Component. SQL query: join `academy_people` + `academy_student_profiles` for this tenant, ordered by display_name. Render in a `<Table>` with columns: Name+email, Student#, Type, Enrollment status, Person status, Open link. Include a client-side filter component and a "+ New Student" button.

3. Create `src/app/admin/people/students/[id]/page.tsx` — Student detail page. Server Component. Load: person, student profile, relationships (joined to person names), last 30 audit events. If tenant_id mismatch: `notFound()`. Tabs: Profile | Enrollment | Relationships | Academic | Audit.
   - Profile tab: two-column display of person fields with an [Edit Profile] button that opens `PersonEditDrawer`
   - Enrollment tab: status badge + [Change Status] button + program + advisor + subdivisions
   - Relationships tab: table of relationships + [+ Add relationship] button
   - Academic tab: link to `/admin/students/[id]` for holds, notes, ShepherdAI
   - Audit tab: table of audit events for this entity_id

4. Create `src/app/admin/people/students/[id]/PersonEditDrawer.tsx` — Client Component. A drawer (use the existing UI dialog/sheet pattern from `src/components/ui/dialog.tsx`). Contains a form with the `UpdatePersonInput` fields. `onSubmit` calls `PATCH /api/admin/students/[id]/person`. On success: `router.refresh()`.

5. Create `src/app/admin/people/students/[id]/EnrollmentStatusModal.tsx` — Client Component. Modal with status select + required reason textarea. Calls `PATCH /api/admin/students/[id]/enrollment-status`.

6. Modify `src/app/admin/settings/people/page.tsx` to add a redirect: `import { redirect } from 'next/navigation'; redirect('/admin/people');` at the top of the page component (after auth).

**CSS classes:** Use only CSS classes that already exist in the codebase. If a new class is needed, define it in the relevant CSS file before using it in JSX. Do not use inline styles.

**Patterns to use:**
- `AdminShell` component with correct `activeSection` and props
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` from `@/components/ui/card`
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from `@/components/ui/table`
- `Badge` from `@/components/ui/badge`
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` from `@/components/ui/tabs`
- `withAcademyDatabaseContext`, `requireActor` for server-side data loading
- `notFound()` from `next/navigation` for cross-tenant access

**Do not:** Create any new API routes. Do not implement business logic in UI components.

**Verification:** `npm run lint && npm run build`. Fix errors before returning.

---

## Prompt 4 — Staff / Faculty / Teacher / Advisor Worker

You are the Staff and Advisor Frontend Worker for ChurchCore Academy. You are implementing Phase 2 Tasks 2.3 and 2.6, and Phase 3 Tasks 3.2 and 3.5.

**Read first:**
- `CLAUDE.md` (mandatory)
- `docs/superpowers/specs/2026-06-30-people-maintenance-design.md` — "Person Type: Staff" and "Person Type: Advisor" sections
- `docs/superpowers/plans/2026-06-30-people-maintenance.md` — Tasks 2.3, 2.6, 3.2, 3.5
- `src/app/admin/staff/page.tsx` — existing staff page (do not remove, keep working)
- `src/app/admin/people/students/[id]/page.tsx` — pattern reference (from Prompt 3 output)

**Assume:** Phase 1 and Prompt 3 (People Hub + Student Detail) are complete.

**Your deliverables:**

1. Create `src/app/admin/people/staff/page.tsx` — Staff list. SQL: join `academy_people` + `academy_staff_profiles`. Columns: Name+email, Staff#, Title, Primary role, Employment status, Open. Filter + "New Staff Member" button.

2. Create `src/app/admin/people/staff/[id]/page.tsx` — Staff detail. Tabs: Profile | Assignment | Sections | Ministry Formation | Audit.
   - Assignment tab: employment status badge + [Change Status] + subdivision + load policy + [Edit Assignment] drawer
   - Sections tab: read-only query of section assignments for this staff person
   - Ministry Formation tab: links to ordination/denomination routes that already exist at `/api/academy/people/[id]/ordinations` and `/api/academy/people/[id]/denomination-memberships`

3. Create `src/app/admin/people/staff/[id]/StaffEditDrawer.tsx` — Client Component. Same pattern as PersonEditDrawer from Prompt 3. Calls `PATCH /api/admin/staff/[id]/person` for person fields and `PATCH /api/admin/staff/[id]/profile` for profile fields.

4. Create `src/app/admin/people/advisors/page.tsx` — Advisor list. SQL from plan Task 3.5. Columns: Name+email, Roles (badge list), Assigned students count, Open.

5. Create `src/app/admin/people/advisors/[id]/page.tsx` — Advisor detail. Tabs: Profile | Assigned Students | Audit.
   - Assigned Students tab: query `academy_student_profiles` where `advisor_person_id = this id`, display count + table
   - [Reassign students] button opens a modal (stub: "reassignment available in a future release")

**Verification:** `npm run lint && npm run build`.

---

## Prompt 5 — Guardian / Applicant Worker

You are the Guardian and Applicant Frontend Worker for ChurchCore Academy. You are implementing Phase 2 Tasks 2.4 and 2.5, and Phase 3 Tasks 3.3 and 3.4.

**Read first:**
- `CLAUDE.md` (mandatory)
- `docs/superpowers/specs/2026-06-30-people-maintenance-design.md` — "Person Type: Guardian" and "Person Type: Applicant" sections
- `docs/superpowers/plans/2026-06-30-people-maintenance.md` — Tasks 2.4, 2.5, 3.3, 3.4
- `src/modules/people/types.ts` — relationship types, authority, visibility
- `src/app/admin/people/students/[id]/page.tsx` — pattern reference

**Your deliverables:**

1. Create `src/app/admin/people/guardians/page.tsx` — Guardian list. SQL from plan Task 3.3 (persons with active guardian role + active student count). Columns: Name+email, Person status, Active students, Open. "+ New Guardian" button.

2. Create `src/app/admin/people/guardians/[id]/page.tsx` — Guardian detail. Tabs: Profile | Students | FERPA / Privacy | Notification Preferences | Audit.
   - Students tab: table of StudentRelationship records for this guardian person, joined to student display names. Each row: student name | relationship type | authority | visibility | status | [Edit] [Deactivate]
   - "+ Link to student" button opens `RelationshipModal` in create mode
   - FERPA / Privacy tab: stub panel with text "FERPA restriction management available when module is enabled"

3. Create `src/app/admin/people/guardians/[id]/RelationshipModal.tsx` — Client Component. Two modes (create / edit). Create mode: student search input (text search against loaded student list), relationship type select, authority select, visibility select, starts/ends date fields. Submit: POST `/api/admin/guardians/[id]/relationships`. Edit mode: authority + visibility + status + dates + required reason. Submit: PATCH `/api/admin/relationships/[relationshipId]`.

4. Create `src/app/admin/people/applicants/page.tsx` — Applicant list. SQL: join `academy_people` + `academy_student_profiles` where `enrollment_status IN ('application_started', 'pending', 'admitted')`. Columns: Name+email, Student#, Student type, Enrollment status, Open. Status filter dropdown.

5. Create `src/app/admin/people/applicants/[id]/page.tsx` — Applicant detail. If `enrollment_status` is `active` or `graduated` or `withdrawn` or `inactive` at load time: redirect to `/admin/people/students/[id]`. Tabs: Profile | Application | Audit.
   - Application tab: enrollment status + [Change status (constrained)] + student type + application document checklist summary (query `academy_application_document_checklists` if table exists, else show "Not available")
   - "Convert to enrolled student" link → `/admin/admissions` (stub link for now)

**Important for guardian relationship selects:** Use the exact string values from `StudentRelationshipType`, `StudentRelationshipAuthority`, and `StudentRelationshipVisibility` in `src/modules/people/types.ts` as the `<option>` values. Label them using the `titleize` pattern from `review-view.ts`.

**Verification:** `npm run lint && npm run build`.

---

## Prompt 6 — Frontend Navigation Worker

You are the Frontend Navigation Worker for ChurchCore Academy. You are implementing Phase 3 Tasks 3.6 and 3.7 — People Hub wiring and admin navigation update.

**Read first:**
- `CLAUDE.md` (mandatory)
- `docs/superpowers/plans/2026-06-30-people-maintenance.md` — Tasks 3.6, 3.7
- `src/components/admin-shell.tsx` — admin shell and nav component
- `src/app/admin/people/page.tsx` — hub page (from Prompt 3 output)

**Assume:** All list pages (Tasks 3.1–3.5) and detail pages (Phase 2) exist.

**Your deliverables:**

1. Modify `src/app/admin/people/page.tsx` (if not already done by Prompt 3):
   - Each type tab: render a metric summary card showing total count and status breakdown
   - Below the metric card: two action links — "View all [type] →" and a button "+ New [type]"
   - The metric data is loaded server-side by querying counts per status

2. Modify `src/components/admin-shell.tsx`:
   - Confirm that "People" appears in the admin sidebar/navigation linking to `/admin/people`
   - If "People" is missing: add it in the appropriate section (alongside Students, Staff, etc.)
   - The `activeSection` value for people pages is `"records"` (matching existing student/staff pattern)

3. Verify the redirect in `src/app/admin/settings/people/page.tsx` is in place (from Prompt 3). If not, add it.

4. Ensure `/admin/staff` still works (do not break it). It can coexist with `/admin/people/staff`.

**Verification:** `npm run lint && npm run build`. Navigate the hub in local dev. Each tab shows a count. Each "View all" link leads to the correct list page.

---

## Prompt 7 — Wildcard Feature Worker (Covenant Record)

You are the Covenant Record Feature Worker for ChurchCore Academy. You are implementing Phase 4 (ADR-0063).

**Read first:**
- `CLAUDE.md` (mandatory)
- `docs/adr/0063-covenant-record-spiritual-profile-model.md` — the decision you must follow exactly
- `docs/superpowers/plans/2026-06-30-people-maintenance.md` — Tasks 4.1 through 4.6
- `src/modules/people/types.ts` — add types here
- `src/modules/academy-config/types.ts` — add `covenantRecords` capability here
- `src/modules/people/student-record-mutations.ts` — pattern reference for mutations

**Your deliverables:**

**Task 4.1:** Create migration `supabase/migrations/[YYYYMMDDHHMMSS]_covenant_records.sql`:
```sql
create table if not exists academy_covenant_records (
  id text primary key,
  tenant_id text not null references academy_institution_profiles(tenant_id) on delete cascade,
  person_id text not null references academy_people(id) on delete cascade,
  covenant_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists academy_covenant_records_tenant_person_idx
  on academy_covenant_records (tenant_id, person_id);
```

**Task 4.2:** Modify `src/modules/people/types.ts` — add `BaptismForm`, `CovenantStatus`, `CovenantFields`, `CovenantRecord` types as defined in the plan.
Modify `src/modules/academy-config/types.ts` — add `covenantRecords: boolean` to `InstitutionCapabilitySet`.

**Task 4.3:** Create `src/modules/people/covenant-mutations.ts` with `upsertCovenantRecord` and `getCovenantRecord`. Rules:
- Check `institutionProfile.capabilities.covenantRecords` first — throw if false
- Role assertion for write: institution_admin, dean, academic_admin, advisor (for assigned students check: `academy_student_profiles where advisor_person_id = actor.userId and person_id = personId`)
- Role assertion for read: same as write
- `getCovenantRecord`: strip `notes` from `covenantFields` if actor does not have institution_admin, dean, or academic_admin role
- Upsert: `INSERT INTO academy_covenant_records ... ON CONFLICT (tenant_id, person_id) DO UPDATE SET covenant_fields = excluded.covenant_fields, updated_at = now()`
- Emit `update_covenant_record` audit event on upsert; `notes` old value is SHA-256 hashed

**Task 4.4:** Create `src/app/api/admin/people/[id]/covenant/route.ts` with GET (`getCovenantRecord`) and PUT (`upsertCovenantRecord`). Thin route pattern.

**Task 4.5:** Create `src/components/covenant-record-tab.tsx` — Client Component.
Props: `covenantEnabled: boolean`, `record: CovenantRecord | null`, `canEditNotes: boolean`, `personId: string`.
If `!covenantEnabled`: return null.
Two cards: "Spiritual Journey" and "Institutional Covenant". If `canEditNotes`: show Notes card with textarea.
"[Edit Covenant Record]" button opens a drawer form. Submit: PUT `/api/admin/people/[id]/covenant`. On success: `router.refresh()`.

**Task 4.6:** Modify all five person detail pages to pass `covenantEnabled` (from `institutionProfile.capabilities.covenantRecords`) and the loaded covenant record to a `CovenantRecordTab` component. The tab is hidden (not rendered) when `covenantEnabled` is false.

**Tests:** `src/modules/people/__tests__/covenant-mutations.test.ts`:
- Success upsert with capability enabled
- Capability-disabled rejection (throw when `covenantRecords = false`)
- Notes stripping: advisor gets record without `notes` field
- Cross-tenant rejection
- `doesNotMatch` check for secret field names in output

**Verification:** `npm test && npm run lint && npm run build`.

---

## Prompt 8 — Test and Verification Worker

You are the Test and Verification Worker for ChurchCore Academy. Your job is final verification after all Phase 1–4 workers have completed.

**Read first:**
- `CLAUDE.md` (mandatory)
- `docs/superpowers/specs/2026-06-30-people-maintenance-design.md` — the full spec
- `docs/superpowers/plans/2026-06-30-people-maintenance.md` — all tasks

**Your verification steps:**

1. Run `npm test` — all tests must pass. Report any failures with the full error message.

2. Run `npm run lint` — no errors. Report any ESLint errors.

3. Run `npm run build` — clean TypeScript build. Report any type errors.

4. Verify these files exist:
   - `src/modules/people/access-policy.ts` — has all 15 `PeopleAccessAction` values
   - `src/modules/people/person-mutations.ts` — has `createPerson`, `updatePersonFields`, `archivePerson`
   - `src/modules/people/staff-mutations.ts` — has `createStaffProfile`, `updateStaffProfile`, `deactivateStaff`
   - `src/modules/people/relationship-mutations.ts` — has all three relationship functions
   - `src/modules/people/guardian-mutations.ts` — has `createGuardianWithLink`
   - `src/modules/people/covenant-mutations.ts` — has `upsertCovenantRecord`, `getCovenantRecord`
   - `src/app/api/admin/people/[id]/route.ts` — exists
   - `src/app/admin/people/page.tsx` — People Hub
   - `src/app/admin/people/students/page.tsx` — student list
   - `src/app/admin/people/students/[id]/page.tsx` — student detail
   - `src/app/admin/people/staff/page.tsx` — staff list
   - `src/app/admin/people/staff/[id]/page.tsx` — staff detail
   - `src/app/admin/people/guardians/page.tsx` — guardian list
   - `src/app/admin/people/guardians/[id]/page.tsx` — guardian detail
   - `src/app/admin/people/applicants/page.tsx` — applicant list
   - `src/app/admin/people/applicants/[id]/page.tsx` — applicant detail
   - `src/app/admin/people/advisors/page.tsx` — advisor list
   - `src/app/admin/people/advisors/[id]/page.tsx` — advisor detail

5. Verify test coverage for all new mutation files:
   - Each `*.test.ts` in `src/modules/people/__tests__/` covers success, validation rejection, and cross-tenant rejection
   - Every test file uses `assert.doesNotMatch` for secret field name check

6. Verify the `InstitutionCapabilitySet` in `src/modules/academy-config/types.ts` includes `covenantRecords: boolean`.

7. Verify that `src/app/admin/settings/people/page.tsx` redirects to `/admin/people`.

8. Verify that the admin navigation (`src/components/admin-shell.tsx`) includes a link to `/admin/people`.

**Report format:**
- Section per verification step
- PASS / FAIL per item
- All FAIL items must be fixed (you may edit code to fix failures)
- Final report: list of all files created or modified, test counts, and build result
