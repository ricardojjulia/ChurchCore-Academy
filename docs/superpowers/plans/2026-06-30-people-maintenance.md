# Implementation Plan: People Maintenance System

Date: 2026-06-30
ADRs: 0062, 0063
Spec: docs/superpowers/specs/2026-06-30-people-maintenance-design.md
Council Review: docs/reviews/council-review-4-people-maintenance.md

---

## Overview

This plan implements full CRUD and profile maintenance for Students, Staff/Faculty, Guardians, Applicants, and Advisors in ChurchCore Academy. Tasks are grouped into four phases. Each phase is independently deployable.

Run `npm test && npm run lint && npm run build` after completing each phase before starting the next.

---

## Phase 1: Core Infrastructure

Phase 1 builds the shared mutation layer, access policy additions, and base API routes that all person types depend on.

---

### Task 1.1 — Extend Access Policy

**What to build:** Add new write action types to `PeopleAccessAction` and the role sets that govern them.

**Files to modify:**
- `src/modules/people/access-policy.ts`

**Changes:**
- Add to `PeopleAccessAction` union: `"write_person" | "write_staff" | "write_guardian" | "write_relationship" | "read_applicant" | "write_applicant" | "read_advisor_load"`
- Add role sets:
  - `personWriteRoles`: institution_admin, registrar
  - `personAdminRoles`: institution_admin
  - `staffWriteRoles`: institution_admin, dean, academic_admin
  - `guardianWriteRoles`: institution_admin, registrar, admissions
  - `relationshipWriteRoles`: institution_admin, registrar
  - `applicantReadRoles`: institution_admin, registrar, admissions, academic_admin, dean
  - `applicantWriteRoles`: institution_admin, registrar, admissions
  - `advisorLoadReadRoles`: institution_admin, dean, academic_admin, registrar
- Add cases to the `canAccessPeopleDomain` switch statement for each new action

**Tests to add:** `src/modules/people/__tests__/access-policy.test.ts` (create if not present)
- Success: each role in each allowed set returns true
- Rejection: unlisted role returns false
- Cross-tenant: mismatched tenant always returns false

**Acceptance criteria:**
- `canAccessPeopleDomain` handles all 15 action types without falling through
- No `any` type introduced
- Existing tests continue to pass

---

### Task 1.2 — Create person-mutations.ts

**What to build:** Admin-facing create, update, and archive of the core `Person` record.

**Files to create:**
- `src/modules/people/person-mutations.ts`

**Functions to implement:**

```typescript
createPerson(actor, input: CreatePersonInput, db): Promise<Person>
updatePersonFields(actor, personId, input: UpdatePersonInput, db): Promise<Person>
archivePerson(actor, personId, reason: string, db): Promise<void>
```

**Rules:**
- `assertTenantIsolation` first in every function
- Role assertions using `personWriteRoles` (create, update) and `personAdminRoles` (archive)
- `createPerson`: generate UUID via `crypto.randomUUID()`, validate displayName non-empty, validate email uniqueness with a select-count query before insert, insert into `academy_people`, emit `create_person` audit event
- `updatePersonFields`: select existing row first, build SET clause dynamically, emit `update_person` audit event per changed field (SHA-256 hash old values of email, phone, date_of_birth, display_name, given_name, family_name)
- `archivePerson`: verify no active student enrollments and no active staff assignments before archiving; reject with descriptive error if found; emit `archive_person` audit event with reason
- Never return database error messages to caller

**Tests to add:** `src/modules/people/__tests__/person-mutations.test.ts`
- `createPerson`: success, duplicate email rejection, empty displayName rejection, cross-tenant rejection
- `updatePersonFields`: success (email change), no-op when no fields change, cross-tenant rejection
- `archivePerson`: success, rejection when active enrollment exists, cross-tenant rejection
- Verify output does not contain secret field names (`doesNotMatch` for `credentialSecret`, `accessToken`, `refreshToken`, `password`)

**Acceptance criteria:**
- All three functions implemented and exported
- Tests cover success, validation, and cross-tenant cases
- Audit events emitted on every mutation

---

### Task 1.3 — Create staff-mutations.ts

**What to build:** Admin create, update, deactivate of `StaffProfile`.

**Files to create:**
- `src/modules/people/staff-mutations.ts`

**Functions to implement:**

```typescript
createStaffProfile(actor, personId, input: CreateStaffProfileInput, db): Promise<StaffProfile>
updateStaffProfile(actor, staffProfileId, input: UpdateStaffProfileInput, db): Promise<StaffProfile>
deactivateStaff(actor, staffProfileId, reason: string, db): Promise<void>
```

**Rules:**
- `assertTenantIsolation` and `staffWriteRoles` assertion in every function
- `createStaffProfile`: verify person exists and belongs to tenant; generate `staff_number` (e.g., `STF-` + zero-padded sequence or UUID fragment); insert into `academy_staff_profiles`; emit `create_staff_profile` audit event
- `updateStaffProfile`: select existing, build SET clause, emit `update_staff_profile` audit event per changed field
- `deactivateStaff`: set `employment_status = 'archived'`, require and log reason; emit `deactivate_staff` audit event
- `staff_number` must be unique within tenant (check before insert)

**Tests to add:** `src/modules/people/__tests__/staff-mutations.test.ts`
- createStaffProfile: success, person not in tenant rejection, cross-tenant rejection
- updateStaffProfile: success, no-op, cross-tenant rejection
- deactivateStaff: success, missing reason rejection, cross-tenant rejection

**Acceptance criteria:** Same pattern as Task 1.2.

---

### Task 1.4 — Create relationship-mutations.ts

**What to build:** Create, update, deactivate `StudentRelationship` records.

**Files to create:**
- `src/modules/people/relationship-mutations.ts`

**Functions to implement:**

```typescript
createStudentRelationship(actor, input: CreateRelationshipInput, db): Promise<StudentRelationship>
updateStudentRelationship(actor, relationshipId, input: UpdateRelationshipInput, db): Promise<StudentRelationship>
deactivateStudentRelationship(actor, relationshipId, reason: string, db): Promise<void>
```

**Rules:**
- `assertTenantIsolation` and `relationshipWriteRoles` in every function
- `createStudentRelationship`: verify both student and related persons exist and are active in tenant; validate contact-only type / authority / visibility combinations using the existing `validateRelationship` logic pattern; insert; emit `create_relationship` audit event
- `updateStudentRelationship`: if authority changes, require reason; SHA-256 hash old authority and visibility in audit; emit `update_relationship` audit event
- `deactivateStudentRelationship`: set status = 'inactive'; require reason; emit `deactivate_relationship` audit event

**Tests to add:** `src/modules/people/__tests__/relationship-mutations.test.ts`
- createStudentRelationship: success (guardian type), emergency contact with academic_decision rejected, pickup_contact with full_guardian visibility rejected, cross-tenant rejection
- updateStudentRelationship: authority change with reason success, authority change without reason rejected, cross-tenant rejection
- deactivateStudentRelationship: success, missing reason rejected, cross-tenant rejection

**Acceptance criteria:** All validation rules from `validation.ts` are enforced.

---

### Task 1.5 — Create guardian-mutations.ts

**What to build:** Create guardian person + auto-link flow.

**Files to create:**
- `src/modules/people/guardian-mutations.ts`

**Functions to implement:**

```typescript
createGuardianWithLink(actor, input: CreateGuardianWithLinkInput, db): Promise<{ person: Person; relationship: StudentRelationship }>
```

**Rules:**
- Wraps `createPerson` (from Task 1.2) + `createStudentRelationship` (from Task 1.4) in a logical sequence
- If relationship creation fails, the person insert must be rolled back (use a DB transaction or accept partial state as a recoverable condition with cleanup guidance)
- Role: `guardianWriteRoles` (institution_admin, registrar, admissions)
- After creating the relationship, insert an `academy_person_role_assignments` row with role = 'guardian', scope_type = 'student', scope_id = student's person ID

**Tests to add:** `src/modules/people/__tests__/guardian-mutations.test.ts`
- Success: guardian + relationship + role assignment all created
- Invalid relationship type rejected before any insert
- Cross-tenant rejection

---

### Task 1.6 — Base Admin API Route: /api/admin/people/[id]

**What to build:** PATCH and DELETE routes for the core person record.

**Files to create:**
- `src/app/api/admin/people/[id]/route.ts`

**Pattern to follow:** Identical to thin route pattern — requireActor, withAcademyDatabaseContext, call module function, map errors to HTTP status codes.

```typescript
export async function PATCH(request, { params }) {
  // 1. requireActor
  // 2. parse + validate body
  // 3. withAcademyDatabaseContext → updatePersonFields(actor, params.id, body, client)
  // 4. return 200 + updated person
  // 5. on validation error: 400
  // 6. on Forbidden: 403
}

export async function DELETE(request, { params }) {
  // 1. requireActor
  // 2. parse reason from body
  // 3. withAcademyDatabaseContext → archivePerson(actor, params.id, reason, client)
  // 4. return 204
}
```

**Tests:** Unit tests in `person-mutations.test.ts` cover the logic. No integration test needed for MVP.

**Acceptance criteria:** Route is thin; all business logic is in the module.

---

### Task 1.7 — Base Admin API Routes: Students, Staff, Guardians, Applicants, Advisors

**What to build:** GET list, GET detail, POST create, PATCH update, DELETE/deactivate routes for each person type.

**Files to create:**
- `src/app/api/admin/students/route.ts` (GET list, POST create)
- `src/app/api/admin/students/[id]/route.ts` (GET detail)
- `src/app/api/admin/students/[id]/person/route.ts` (PATCH core person fields)
- `src/app/api/admin/students/[id]/profile/route.ts` (PATCH student profile)
- `src/app/api/admin/students/[id]/enrollment-status/route.ts` (PATCH status + reason)
- `src/app/api/admin/staff/route.ts` (GET list, POST create)
- `src/app/api/admin/staff/[id]/route.ts` (GET detail)
- `src/app/api/admin/staff/[id]/person/route.ts` (PATCH)
- `src/app/api/admin/staff/[id]/profile/route.ts` (PATCH)
- `src/app/api/admin/guardians/route.ts` (GET list, POST create)
- `src/app/api/admin/guardians/[id]/route.ts` (GET detail)
- `src/app/api/admin/guardians/[id]/person/route.ts` (PATCH)
- `src/app/api/admin/guardians/[id]/relationships/route.ts` (POST create relationship)
- `src/app/api/admin/relationships/[id]/route.ts` (PATCH update, DELETE deactivate)
- `src/app/api/admin/applicants/route.ts` (GET list)
- `src/app/api/admin/applicants/[id]/route.ts` (GET detail)
- `src/app/api/admin/applicants/[id]/person/route.ts` (PATCH)
- `src/app/api/admin/applicants/[id]/status/route.ts` (PATCH status, constrained)
- `src/app/api/admin/advisors/route.ts` (GET list)
- `src/app/api/admin/advisors/[id]/route.ts` (GET detail)
- `src/app/api/admin/advisors/[id]/person/route.ts` (PATCH)

Each route follows the thin pattern established in Task 1.6.

**Acceptance criteria:**
- All routes return 403 for wrong role
- All routes return 400 for invalid body
- Route handlers contain no business logic

---

## Phase 2: Per-Type Edit Panels

Phase 2 builds the detail page for each person type. Each detail page is a Next.js App Router Server Component at the routes defined in the spec.

---

### Task 2.1 — People Hub Page

**What to build:** Replace `/admin/settings/people` with a tabbed `/admin/people` hub.

**Files to create/modify:**
- `src/app/admin/people/page.tsx` (new hub page)
- `src/app/admin/settings/people/page.tsx` (modify to redirect to `/admin/people`)

**Hub page structure:**
- Tabs: Overview | Students | Faculty and Staff | Guardians | Applicants | Advisors
- Overview tab: existing PeopleMetricTiles + validation panel + role coverage (moved from settings/people)
- Each type tab: metric row + "New [Type]" button + table (initially empty placeholder) + link to full list page
- Uses the existing `AdminShell` and `Card` components

**Acceptance criteria:** Navigating to `/admin/settings/people` redirects. Hub renders all tabs. Overview tab shows existing metrics.

---

### Task 2.2 — Student Detail Panel

**What to build:** `/admin/people/students/[id]` page with Profile, Enrollment, Relationships, Academic, and Audit tabs.

**Files to create:**
- `src/app/admin/people/students/[id]/page.tsx`
- `src/app/admin/people/students/[id]/PersonEditDrawer.tsx` (client component, drawer)
- `src/app/admin/people/students/[id]/EnrollmentStatusModal.tsx` (client component, modal)

**Data loading:**
- Server component queries: person row, student profile, relationships, role assignments, recent audit events (last 20)
- Uses `withAcademyDatabaseContext` with `requireActor`
- Returns `notFound()` if student's tenant_id !== actor.tenantId

**PersonEditDrawer:** Client component. Accepts person data as props. Contains a form with UpdatePersonInput fields. On submit, calls `PATCH /api/admin/students/[id]/person`. On success, triggers router.refresh().

**EnrollmentStatusModal:** Client component. Select for new status + required reason textarea. Calls `PATCH /api/admin/students/[id]/enrollment-status`.

**Relationships section:** Table showing active relationships with Edit and Deactivate actions (each opens appropriate modal). "+ Add relationship" button opens a modal with student search + relationship type/authority/visibility fields.

**Audit tab:** Table of last 50 audit events for this person_id.

**Acceptance criteria:**
- Page loads with correct data for the tenant
- `notFound()` returned for cross-tenant access
- All tabs render without errors
- Edit drawer submits and updates

---

### Task 2.3 — Staff Detail Panel

**What to build:** `/admin/people/staff/[id]` page with Profile, Assignment, Sections, Ministry Formation, and Audit tabs.

**Files to create:**
- `src/app/admin/people/staff/[id]/page.tsx`
- `src/app/admin/people/staff/[id]/StaffEditDrawer.tsx`
- `src/app/admin/people/staff/[id]/EmploymentStatusModal.tsx`

**Data loading:** Person + staff profile + role assignments + course sections (query from `academy_course_sections` joined to section assignments) + audit events.

**Acceptance criteria:** Same pattern as Task 2.2.

---

### Task 2.4 — Guardian Detail Panel

**What to build:** `/admin/people/guardians/[id]` page.

**Files to create:**
- `src/app/admin/people/guardians/[id]/page.tsx`
- `src/app/admin/people/guardians/[id]/RelationshipModal.tsx` (create/edit relationship)

**Data loading:** Person + relationships (with joined student display names) + audit events.

**RelationshipModal:** Two modes: create (POST to /api/admin/guardians/[id]/relationships) and edit (PATCH to /api/admin/relationships/[id]).

**Acceptance criteria:** Same pattern as Task 2.2.

---

### Task 2.5 — Applicant Detail Panel

**What to build:** `/admin/people/applicants/[id]` page.

**Files to create:**
- `src/app/admin/people/applicants/[id]/page.tsx`

**Data loading:** Person + student profile (where enrollment_status in application_started, pending, admitted) + audit events. If enrollment_status is `active` or later, redirect to `/admin/students/[id]`.

**Acceptance criteria:** Same pattern. Redirects correctly for converted applicants.

---

### Task 2.6 — Advisor Detail Panel

**What to build:** `/admin/people/advisors/[id]` page.

**Files to create:**
- `src/app/admin/people/advisors/[id]/page.tsx`

**Data loading:** Person + active role assignments filtered to advisor-capable roles + assigned students (query academy_student_profiles where advisor_person_id = this person's id) + audit events.

**Acceptance criteria:** Assigned student count and list render correctly.

---

### Task 2.7 — Create Person Modal Component

**What to build:** Reusable two-step create modal for Student, Staff, and Guardian types.

**Files to create:**
- `src/components/create-person-modal.tsx` (client component)

**Props:**
```typescript
interface CreatePersonModalProps {
  personType: 'student' | 'staff' | 'guardian';
  opened: boolean;
  onClose: () => void;
  onCreated: (personId: string) => void;
}
```

**Step 1:** Core person fields form.
**Step 2:** Type-specific profile fields (conditional render based on `personType`).
**Submit:** POST to the appropriate `/api/admin/[type]` endpoint. On success: call `onCreated(personId)`.

**Acceptance criteria:** All three type variants work. Navigation to new record on success.

---

## Phase 3: People List and Navigation Redesign

Phase 3 builds the list pages for each person type and wires the People Hub tabs.

---

### Task 3.1 — Student List Page

**What to build:** `/admin/people/students` — tabular list with search, status filter, and "+ New Student" button.

**Files to create:**
- `src/app/admin/people/students/page.tsx`

**Data loading:** Server component. Query:

```sql
select p.id, p.display_name, p.email, p.person_status,
       sp.student_number, sp.student_type, sp.enrollment_status
from academy_people p
join academy_student_profiles sp on sp.person_id = p.id and sp.tenant_id = p.tenant_id
where p.tenant_id = $1
order by p.display_name asc
```

**Client-side filter:** `displayName`, `email`, `studentNumber`. Status filter on `enrollmentStatus`.

**Table columns:** Name + email | Student number | Type | Enrollment status | Person status | Open

**Acceptance criteria:** List loads. Filter works client-side. "+ New Student" opens CreatePersonModal with type='student'.

---

### Task 3.2 — Staff List Page

**What to build:** `/admin/people/staff` — list of staff profiles.

**Files to create:**
- `src/app/admin/people/staff/page.tsx`

**Note:** This can replace or coexist with `/admin/staff`. Link both. The `/admin/staff` page can remain as-is (it already works); `/admin/people/staff` provides the maintenance-focused view.

**Acceptance criteria:** Same pattern as Task 3.1.

---

### Task 3.3 — Guardian List Page

**What to build:** `/admin/people/guardians` — list of persons with active guardian role assignments.

**Files to create:**
- `src/app/admin/people/guardians/page.tsx`

**Query:**
```sql
select distinct p.id, p.display_name, p.email, p.person_status,
       count(sr.id) filter (where sr.status = 'active') as active_student_count
from academy_people p
join academy_person_role_assignments ra on ra.person_id = p.id and ra.tenant_id = p.tenant_id
                                       and ra.role = 'guardian' and ra.status = 'active'
left join academy_student_relationships sr on sr.related_person_id = p.id and sr.tenant_id = p.tenant_id
where p.tenant_id = $1
group by p.id, p.display_name, p.email, p.person_status
order by p.display_name asc
```

**Table columns:** Name + email | Person status | Active students | Open

---

### Task 3.4 — Applicant List Page

**What to build:** `/admin/people/applicants` — list of persons in pre-admission enrollment statuses.

**Files to create:**
- `src/app/admin/people/applicants/page.tsx`

**Query:** Persons where `sp.enrollment_status IN ('application_started', 'pending', 'admitted')`.

---

### Task 3.5 — Advisor List Page

**What to build:** `/admin/people/advisors` — list of persons with advisor-capable roles.

**Files to create:**
- `src/app/admin/people/advisors/page.tsx`

**Query:**
```sql
select p.id, p.display_name, p.email,
       array_agg(distinct ra.role) as roles,
       count(distinct sp.person_id) as assigned_student_count
from academy_people p
join academy_person_role_assignments ra on ra.person_id = p.id and ra.tenant_id = p.tenant_id
                                       and ra.role in ('advisor','faculty','professor','dean','academic_admin')
                                       and ra.status = 'active'
left join academy_student_profiles sp on sp.advisor_person_id = p.id and sp.tenant_id = p.tenant_id
where p.tenant_id = $1
group by p.id, p.display_name, p.email
order by p.display_name asc
```

---

### Task 3.6 — People Hub Tab Wiring

**What to build:** Wire the hub tabs (Task 2.1) to the list pages. Each hub tab shows a summary metric + a link to the full list page, rather than embedding the full list in the hub.

**Files to modify:**
- `src/app/admin/people/page.tsx`

Replace tab content placeholders with:
- Metric card (count + status breakdown)
- "View all [type]" link to the list page
- "+ New [type]" button opening CreatePersonModal

**Acceptance criteria:** Hub is the entry point. Each type has metrics and navigation.

---

### Task 3.7 — Admin Navigation Update

**What to build:** Add "People" link to admin sidebar navigation.

**Files to modify:**
- `src/components/admin-shell.tsx` (or wherever admin nav is defined)

Add entry: `People` → `/admin/people` with the appropriate `activeSection` key.

**Acceptance criteria:** People hub is reachable from the admin nav without manually typing the URL.

---

## Phase 4: Covenant Record (Wildcard Feature)

Phase 4 is independent of Phases 1-3 and can be scheduled separately.

---

### Task 4.1 — Covenant Record Migration

**What to build:** New `academy_covenant_records` table.

**Files to create:**
- `supabase/migrations/[timestamp]_covenant_records.sql`

Contents per ADR-0063 schema.

**Acceptance criteria:** Migration runs without error against local Supabase. Unique index on (tenant_id, person_id).

---

### Task 4.2 — Covenant Record Types

**What to build:** TypeScript types for the Covenant Record.

**Files to modify:**
- `src/modules/people/types.ts`

**Add:**
```typescript
export type BaptismForm = 'immersion' | 'sprinkling' | 'affusion' | 'other';
export type CovenantStatus = 'not_signed' | 'signed' | 'renewed' | 'inactive';

export interface CovenantFields {
  faithDecisionDate?: string;
  baptismDate?: string;
  baptismForm?: BaptismForm;
  homeChurchName?: string;
  homeChurchCity?: string;
  covenantStatus?: CovenantStatus;
  covenantSignedDate?: string;
  covenantWitnessName?: string;
  spiritualFormationTrack?: string;
  notes?: string;   // restricted read access — institution_admin, dean, academic_admin only
}

export interface CovenantRecord {
  id: string;
  tenantId: string;
  personId: string;
  covenantFields: CovenantFields;
  createdAt: string;
  updatedAt: string;
}
```

**Also modify:** `InstitutionCapabilitySet` in `src/modules/academy-config/types.ts` — add `covenantRecords: boolean`.

**Acceptance criteria:** No compilation errors. `npm run build` passes.

---

### Task 4.3 — Covenant Record Mutations

**What to build:** Create/upsert and read functions for Covenant Records.

**Files to create:**
- `src/modules/people/covenant-mutations.ts`

**Functions:**
```typescript
upsertCovenantRecord(actor, personId, fields: Partial<CovenantFields>, db): Promise<CovenantRecord>
getCovenantRecord(actor, personId, db): Promise<CovenantRecord | null>
```

**Rules:**
- Capability check: reject if `institutionProfile.capabilities.covenantRecords !== true`
- Role assertion: writer = institution_admin, dean, academic_admin, advisor (for assigned students)
- `notes` field: read restricted to institution_admin, dean, academic_admin — strip from return value for other roles
- Upsert: use `INSERT ... ON CONFLICT (tenant_id, person_id) DO UPDATE SET ...`
- Audit emit on every upsert

**Tests:** `src/modules/people/__tests__/covenant-mutations.test.ts`
- Success upsert, capability-disabled rejection, notes strip for advisor, cross-tenant rejection

---

### Task 4.4 — Covenant Record API Route

**What to build:**

**Files to create:**
- `src/app/api/admin/people/[id]/covenant/route.ts` (GET, PUT)

---

### Task 4.5 — Covenant Record Tab Component

**What to build:** Covenant Record tab for every person detail page.

**Files to create:**
- `src/components/covenant-record-tab.tsx` (client component)

**Conditional rendering:** Only visible when `institutionProfile.capabilities.covenantRecords === true`. Prop: `covenantEnabled: boolean`.

**Acceptance criteria:** Tab hidden when capability off. Notes field hidden for non-admin roles.

---

### Task 4.6 — Wire Covenant Tab into All Detail Pages

**Files to modify:**
- `src/app/admin/people/students/[id]/page.tsx`
- `src/app/admin/people/staff/[id]/page.tsx`
- `src/app/admin/people/guardians/[id]/page.tsx`
- `src/app/admin/people/applicants/[id]/page.tsx`
- `src/app/admin/people/advisors/[id]/page.tsx`

Add `CovenantRecordTab` to the Tabs component in each page. Pass `covenantEnabled` from the loaded institution profile.

---

## Verification Checklist (run after each phase)

```
npm test          — all tests pass
npm run lint      — no ESLint errors
npm run build     — TypeScript + Next.js build passes
```

Additionally for each phase:
- Phase 1: All new mutation functions have success + validation + cross-tenant tests
- Phase 2: Each detail page renders without error in local dev; `notFound()` for cross-tenant
- Phase 3: Each list page loads and client-side filter works
- Phase 4: Covenant tab hidden when capability off; notes field absent for non-admin roles
