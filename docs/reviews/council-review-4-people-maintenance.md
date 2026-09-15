# Council Review IV: People Maintenance System

Date: 2026-06-30
Status: Final
Review Number: IV (fourth council session)

---

## Scope

This review covers the design of a corporate-grade people maintenance system for ChurchCore Academy's People and Roles admin surface. The system must support full CRUD and profile maintenance for every person type: Student, Professor/Faculty/Teacher, Guardian, Applicant (pre-student), and Advisor.

The Council reviewed the existing module, schema, and access policy code before deliberating.

---

## Audit of Current State

### What Exists

The `src/modules/people/` module is well-structured for read and reporting, and has growing mutation support:

**Schema (from migrations):**
- `academy_people` — core person record (id, display_name, given_name, family_name, preferred_name, email, phone, date_of_birth, person_status, address fields, emergency contact fields)
- `academy_person_role_assignments` — role-scoped assignments with date ranges
- `academy_student_profiles` — student-type, enrollment status, subdivision, program, advisor, guardian_required
- `academy_staff_profiles` — staff number, title, primary_role, subdivision, employment_status, load_policy
- `academy_student_relationships` — type, authority, visibility, status, date range
- `academy_account_links` — provider references without stored secrets

**Module functions:**
- `postgres-repository.ts`: `fetchPeopleConfiguration` (read-only, bulk fetch)
- `review-view.ts`: `buildPeopleReviewModel` (read-only model builder)
- `review-loader.ts`: `loadPeopleReviewModel` (thin loader)
- `validation.ts`: full validation suite, `canGuardianAccessStudentCategory`
- `access-policy.ts`: `canAccessPeopleDomain`, `assertPeopleAccess` (covers 8 actions)
- `student-record-mutations.ts`: `updateStudentProfile` (student-self), `updateStudentEnrollmentFields` (registrar), `addAdvisorNote`, `listAdvisorNotes`, `addHold`, `clearHold`, `listHolds`, `updateEnrollmentStatus`

**API routes touching people:**
- `GET/POST /api/academy/students` — student list/create
- `GET /api/academy/students/[id]` — student read
- `POST /api/academy/staff/invite` — staff invite (creates person + role)
- `PATCH /api/academy/staff/[id]` — likely staff update
- `POST /api/academy/people/role-assignments` — assign role
- `GET/PUT /api/academy/students/me/contact` — student self-updates contact
- Guardian routes for reading student data

**Current admin pages:**
- `/admin/settings/people` — read-only review page with coverage, students, staff, relationships, account links, validation, and a StaffInviteForm + RoleAssignmentForm
- `/admin/students` — tabular student list with ShepherdAI signals
- `/admin/students/[id]` — student detail with tabs (registrations, ShepherdAI, holds, notes)
- `/admin/staff` — tabular staff directory with deactivate button

### What Is Missing

The following capabilities have zero or incomplete implementation:

| Gap | Detail |
|-----|--------|
| No person CREATE outside of staff invite or applicant flow | Cannot create a bare person record from admin |
| No admin update of core person fields | `updateStudentProfile` is student-self-only; no admin equivalent for editing name, email, DOB |
| No staff profile edit | No endpoint to update title, load_policy, employment_status, subdivision |
| No guardian profile or CREATE flow | Guardians are created implicitly via invite but have no dedicated admin surface |
| No applicant person type | `StudentEnrollmentStatus.application_started` exists but no Applicant-specific admin panel or person-creation flow independent of the application portal |
| No advisor profile surface | Advisors exist as role assignments but have no dedicated profile panel |
| No person archive/deactivate from people module | `DeactivateStaffButton` exists but operates outside the formal module |
| No relationship CREATE/EDIT UI | Relationships are read-only in the review panel; no flow to add or modify a guardian link |
| No person SEARCH | The review page lists all people; there is no search or filter |
| No audit display | `academy_audit_events` is populated but not surfaced in the admin UI |
| `access-policy.ts` has write_people defined but no write mutation uses it | `write_people` and `admin_people` actions are defined in the policy but nothing calls `assertPeopleAccess` for mutations on core person fields |

### Person Type Coverage Gap Matrix

| Feature | Student | Staff/Faculty | Guardian | Applicant | Advisor |
|---------|---------|---------------|----------|-----------|---------|
| View record | Partial | Partial | None | None | None |
| Create person | Via admission | Via invite | None | None | None |
| Edit core fields | Student-self only | None | None | None | None |
| Edit profile fields | Registrar (program, advisor) | None | None | None | None |
| Edit status | Registrar (enrollment) | Partial (deactivate) | None | None | None |
| Archive/deactivate | None (formal) | Partial | None | None | None |
| View relationships | Read-only review | N/A | None | None | None |
| Create/edit relationship | None | N/A | None | None | None |
| Audit trail | Written, not shown | None | None | None | None |

---

## Councilor Findings

### 1. Product and SIS Domain Councilor

Faith-based institutions of every type — children's school, Bible school, seminary, college, university — share a fundamental SIS requirement: every person type must be a first-class citizen with a managed lifecycle. The current system treats students as primary and everyone else as secondary or implicit.

**Minimum viable record vs. full professional record by type:**

**Student:** Minimum = person record + student number + enrollment status + student type. Full = plus program, subdivision, advisor, guardian links, holds, contact info, emergency contact, academic record. What institutions need: the ability to update enrollment status with reason, change program or advisor, add/remove holds, and view the audit trail of those changes. The student self-edit path is built; the admin edit path is incomplete.

**Professor/Faculty/Teacher:** Minimum = person record + staff number + title + primary_role + employment_status. Full = plus subdivision, load policy, section assignments, department, credentials. What institutions need most: the ability to change title, adjust load policy (for adjunct management), move staff between subdivisions, and deactivate or archive cleanly.

**Guardian:** Minimum = person record + at least one active student relationship with defined authority and visibility. Full = plus communication preferences, FERPA consent status, notification preferences, emergency authority flags. Guardians are currently created only through implicit invite; institutions need an admin flow to create a guardian record, link them to a student, and manage relationship authority and visibility without going through the full application portal.

**Applicant:** Minimum = person record + `application_started` enrollment status + student type. Full = plus application document checklist status, admission decision, conversion timestamp. Applicants exist in the system (the admissions module handles them) but they have no dedicated admin panel in the People module. A pre-student Applicant view is needed so registrars can manage the person record before and after admission decision.

**Advisor:** Minimum = person record + active role assignment for "advisor" (or advisor-capable role: faculty, professor, dean, academic_admin). Full = plus assigned-student list, load, subdivision, pastoral or academic credential. Advisors are currently visible only as references in student profiles. A dedicated Advisor panel should show the advisor's assigned students, their load, and allow reassignment.

**Cross-cutting requirements:**
- Every person type needs a status lifecycle: active, inactive, invited, archived
- Every mutation needs reason capture for audit
- Ministry Formation Records (ordination, denomination membership) are cross-cutting for all person types at faith-based institutions — this is unique and must remain discoverable from the person record
- Bulk operations are NOT required in MVP — individual record maintenance is the correct scope

---

### 2. Domain Architect

**Module growth strategy:** The people module should remain a single module (`src/modules/people/`) with sub-files per concern. Do NOT split into role-specific modules. The domain logic is tightly coupled through person-profile-role relationships and splitting creates cross-module dependencies that violate the one-module-per-domain rule.

New files to create within `src/modules/people/`:

- `person-mutations.ts` — admin create/update/archive of the core `Person` record (admin path, not student-self path)
- `staff-mutations.ts` — admin create/update/deactivate of `StaffProfile`
- `guardian-mutations.ts` — admin create/link/update of guardian `Person` + `StudentRelationship`
- `applicant-mutations.ts` — admin view/update of applicant persons (thin wrapper over student mutations with applicant-status guard)
- `relationship-mutations.ts` — create/update/deactivate `StudentRelationship` records

**Repository pattern:** All mutation functions follow the established pattern from `student-record-mutations.ts`:
- Accept `(actor: AcademyActor, input: ..., db: Queryable)`
- Call `assertTenantIsolation` first
- Call role assertion second
- Verify target exists in tenant before mutation
- Emit audit event for every field change (use `sha256Hash` for old values of sensitive fields)
- Never return database error messages directly

**New API routes needed:**

```
PATCH  /api/admin/people/[id]                  — update core person fields (name, email, phone, DOB, status)
POST   /api/admin/people                        — create bare person record
DELETE /api/admin/people/[id]                   — archive person (soft delete, sets person_status = 'archived')

POST   /api/admin/staff                         — create staff profile (replaces/extends current invite flow)
PATCH  /api/admin/staff/[id]                   — update staff profile (title, load_policy, subdivision, status)
DELETE /api/admin/staff/[id]                   — deactivate staff (sets employment_status = 'archived')

POST   /api/admin/guardians                     — create guardian person + link to student
PATCH  /api/admin/guardians/[id]               — update guardian person fields
POST   /api/admin/guardians/[id]/relationships — create new student relationship
PATCH  /api/admin/relationships/[id]           — update relationship authority/visibility/status
DELETE /api/admin/relationships/[id]           — deactivate relationship

GET    /api/admin/applicants                    — list applicants (enrollment_status in application_started, pending)
PATCH  /api/admin/applicants/[id]              — update applicant person fields before admission

GET    /api/admin/advisors                      — list persons with advisor-capable roles + their student loads
PATCH  /api/admin/advisors/[id]                — update advisor person fields (thin alias of person PATCH)
```

**Note on route namespace:** Use `/api/admin/` as the namespace for these admin-only routes to distinguish them from the student-facing `/api/academy/` routes. Auth guard is `requireActor` + role assertion in every handler.

**Existing patterns to follow:**
- `withAcademyDatabaseContext` for all database access
- `assertTenantIsolation` before any query
- Role assertion using established role sets from `access-policy.ts`
- `emitAuditEvent` pattern from `student-record-mutations.ts`
- Map-then-return pattern: never pass raw DB rows to client

**Access policy additions needed:**
- `write_staff` — institution_admin, dean, academic_admin
- `write_guardian` — institution_admin, registrar, admissions
- `write_relationship` — institution_admin, registrar
- `read_applicant` — institution_admin, registrar, admissions, academic_admin, dean
- `write_applicant` — institution_admin, registrar, admissions
- `read_advisor_load` — institution_admin, dean, academic_admin, registrar

---

### 3. UX and Frontend Councilor

**Current state assessment:** The People and Roles settings page is a read-only review dashboard. The student detail page (`/admin/students/[id]`) is the only page with interaction (holds, notes, enrollment status). There is no edit flow anywhere in the People module for admin users.

**Proposed navigation architecture:**

The existing `/admin/settings/people` page becomes a **People Hub** — the entry point for all person-type navigation. It retains the metrics and validation summary but gains a navigation sidebar or tab group:

```
People Hub
  ├── Overview (current review page content)
  ├── Students
  ├── Faculty and Staff
  ├── Guardians
  ├── Applicants
  └── Advisors
```

Each section is a list page with a "New [type]" action button and row-level "Open" links. Opening a record navigates to a detail page with an edit panel.

**Person detail panel — universal structure:**

Every person type detail page follows the same three-zone layout:

```
┌──────────────────────────────────────────────────────────┐
│  [Back to list]    Person Name    [Status badge]  [Edit] │
├──────────────────────────────────────────────────────────┤
│  Tab bar: Profile | [Type-specific tabs] | Audit         │
├─────────────────┬────────────────────────────────────────┤
│  Left rail:     │  Main content area                     │
│  Quick facts    │  Active tab content                    │
│  (name, email,  │                                        │
│   status,       │                                        │
│   created date) │                                        │
└─────────────────┴────────────────────────────────────────┘
```

The Edit button opens an **inline edit panel** (drawer or modal) with field-level validation. Never navigate away to edit — keep the user in context.

**Per-type tab structure:**

*Student:*
- Profile (core person fields, student number, type, DOB, contact info)
- Enrollment (status, program, advisor, subdivisions)
- Relationships (guardian and advisor links with authority/visibility)
- Academic (holds, advisor notes, registrations — links to existing student detail page)
- Ministry Formation (ordination status, denomination membership if applicable)
- Audit (field-change log)

*Faculty/Staff/Teacher/Professor:*
- Profile (core person fields, staff number, title, primary role)
- Assignment (subdivision, load policy, employment status)
- Sections (course sections assigned — read-only, links to course admin)
- Ministry Formation (for institutions that track faculty ordination credentials)
- Audit

*Guardian:*
- Profile (core person fields)
- Students (linked students with authority and visibility per relationship)
- FERPA/Privacy (restriction status, consent log)
- Notification Preferences
- Audit

*Applicant:*
- Profile (core person fields)
- Application (enrollment status, admission decision, document checklist status)
- Conversion (link to convert to enrolled student if admitted)
- Audit

*Advisor:*
- Profile (core person fields)
- Assigned Students (list of students with advisor relationship, load count)
- Audit

**Create flow:**

New person creation uses a modal with a two-step pattern:
1. Step 1: Core person fields (name, email, phone, DOB, person_status). Validates email uniqueness within tenant.
2. Step 2: Type-specific profile fields (student type + enrollment status; or staff title + primary_role; or guardian relationship student search).

On save, close modal and navigate to the new person's detail page.

**Edit flow:**

The Edit button opens a drawer with only the editable fields for that panel. Required fields are marked. Submit triggers API call + optimistic UI update. On error, display error inline without destroying the form state.

**Archive/deactivate flow:**

A red "Deactivate" or "Archive" action button sits in the person header (visible to institution_admin only). Clicking opens a confirmation modal with a required reason field. Confirms the irreversibility in appropriate terms.

**Search and filter:**

Each list page has a search bar (client-side filter on loaded results for MVP; server-side for large tenants). Each list also has a status filter dropdown (active/inactive/invited/archived). Student list additionally filters by enrollment status and student type.

**No dead ends:** Every empty state has an action. Every error has a retry or contact-admin fallback. Every form has a cancel that returns to context.

---

### 4. Security and Privacy Councilor

**Who can view/edit which person types:**

| Action | institution_admin | dean | registrar | academic_admin | admissions | advisor | faculty/teacher/professor | guardian | student |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Read any person | Y | Y | Y | Y | Y | - | - | - | - |
| Create person | Y | - | Y | - | Y | - | - | - | - |
| Edit core person fields | Y | - | Y | - | - | - | - | - | self only |
| Archive person | Y | - | - | - | - | - | - | - | - |
| Edit student profile | Y | - | Y | - | - | - | - | - | - |
| Edit student enrollment | Y | - | Y | - | - | - | - | - | - |
| View student contact info | Y | Y | Y | Y | Y | scoped | scoped | scoped | self |
| Edit staff profile | Y | Y | - | Y | - | - | - | - | - |
| Create guardian + link | Y | - | Y | - | Y | - | - | - | - |
| Edit guardian relationship | Y | - | Y | - | - | - | - | - | - |
| Read advisor student load | Y | Y | Y | Y | - | self | - | - | - |

**Sensitive field designations:**

The following fields require special handling:

- `date_of_birth`: FERPA-protected for students. Must not appear in list views. Required in audit log (hashed old value only).
- `email`, `phone`: Personally Identifiable Information. Audit log on change with hashed old values. Never logged in plain text.
- Guardian relationship `authority` and `visibility`: High consequence fields. Any change must be audit-logged with before/after values (old values hashed, new values logged) and reason.
- Student enrollment status: Regulated. Already implemented with audit trail. Must remain.
- Advisor notes: Already protected from guardian access. Must maintain.
- Ministry Formation records (ordination, denomination): Sensitive personal religious data. Access limited to institution_admin and the person themselves.

**Audit requirements:**

All mutations on the following must emit to `academy_audit_events`:

1. Core person field changes (email, phone, DOB, name)
2. Person status changes (active → inactive → archived)
3. Staff employment status changes
4. Student enrollment status changes (already done)
5. Guardian relationship authority/visibility changes
6. Guardian relationship create/deactivate
7. Role assignment create/deactivate
8. Person create
9. Person archive

Audit events must include: `actor_person_id`, `action`, `entity_type`, `entity_id`, `result_status`, `redacted_metadata`. Old values of sensitive fields are stored as SHA-256 hash only.

**Cross-tenant isolation:** Every repository function must verify target person's `tenant_id` matches `actor.tenantId` before any mutation. This is non-negotiable and exists in the pattern already.

**Account links:** `credentialSecret`, `accessToken`, `refreshToken`, `password` must never be stored. Validation for this already exists. The admin UI must never expose or accept these fields.

**Guardian FERPA restriction:** The `academy_guardian_ferpa_restrictions` table already exists (migration 20260623070000). The guardian detail panel must surface the FERPA restriction status and allow institution_admin and registrar to record/lift restrictions.

**Secret field name check:** Test suites for all new mutation functions must verify that secret field names (`credentialSecret`, `accessToken`, `refreshToken`, `password`) do not appear in test output using `doesNotMatch`.

---

### 5. Wildcard Strategist — The Covenant Record

**Concept Name: The Covenant Record**

Faith-based institutions have a category of person-level data that no secular SIS provides: the spiritual journey and covenant commitments of each person in the institution. This is distinct from Ministry Formation Records (which track formal ordinations and denominational membership) and from academic records (which track grades and enrollment).

The Covenant Record is a lightweight, opt-in, institution-configurable spiritual profile layer that lives on every person record. It contains:

**Spiritual Journey Fields (institution-configurable, all optional):**
- Salvation/faith decision date
- Baptism date and form (immersion, sprinkling, affusion)
- Church membership: home church name and city
- Covenant commitment status (configurable per institution: e.g., "Community Covenant", "Enrollment Covenant", "Ministry Covenant")
- Covenant signature date and witness
- Spiritual formation track (e.g., "Discipleship 1", "Mentorship", "Leadership Development")

**Why this is product-differentiating:**

No commercial SIS (Populi, Ellucian, PowerSchool, FACTS SIS) offers structured spiritual journey tracking. It is universally handled with free-text notes or custom fields. ChurchCore Academy can offer a typed, queryable, reportable spiritual profile that:

1. Is completely opt-in at the institution level — if an institution doesn't configure it, it never appears
2. Is configurable — each institution defines which fields apply to their tradition (e.g., a Reformed seminary tracks baptism form; a Pentecostal Bible school tracks Spirit-baptism date)
3. Is visible to appropriate roles — institution_admin, academic_admin, dean, and the person themselves. Never visible to guardians by default.
4. Is reportable — ShepherdAI can include Covenant Record completeness as a signal when recommending pastoral outreach workflows
5. Is NOT a grading instrument — purely a ministry record, clearly separated from academic standing

**What this requires architecturally:**
- A new `academy_covenant_records` table with a JSONB `covenant_fields` column (institution drives the schema through institution configuration)
- A new `CovenantRecord` type in the people module
- A Covenant tab in the person detail panel (hidden if institution doesn't enable it)
- Institution-level configuration of which covenant fields are active (`InstitutionProfile.capabilities.covenantRecords: boolean`)
- No LLM/AI involvement — purely structured data entry

**Why it belongs in this review:**
The People Maintenance System is the right place to introduce the Covenant Record because it is a person-level field, not a course-level or enrollment-level field. Adding it here avoids retrofitting later.

This is the one thing ChurchCore Academy can do for faith-based institutions that no secular SIS will ever build.

---

## Cross-Council Consensus

**Agreed design decisions:**

1. **Single module, multiple sub-files.** Keep all people logic in `src/modules/people/`. New files per concern.

2. **Person first, profile second.** Every mutation workflow starts with the core `Person` record, then addresses type-specific profile fields. The person always exists before the profile.

3. **Admin mutation path is separate from student self-edit path.** `student-record-mutations.ts` handles student-self edits. New `person-mutations.ts` and `staff-mutations.ts` handle admin edits. They have different role guards and audit patterns.

4. **All mutations audit-log.** The `emitAuditEvent` pattern from `student-record-mutations.ts` is the established standard. All new mutations follow it.

5. **Applicant is a view/filter into Students, not a separate entity.** An Applicant is a `Person` with a `StudentProfile` in `application_started` or `pending` enrollment status. The Applicant panel is a filtered view of the student list, not a separate entity type.

6. **Advisor is a view/filter into Staff, not a separate entity.** An Advisor is a `Person` with an active advisor-capable role assignment. The Advisor panel renders persons who have one or more advisor-capable role assignments.

7. **The Covenant Record is the wildcard feature and requires its own ADR.** It is architecturally independent and must not block the core maintenance system.

8. **No bulk operations in MVP.** Individual record maintenance only.

9. **People Hub navigation replaces the settings page structure.** Route: `/admin/people` becomes the hub. Existing `/admin/settings/people` redirects there.

---

## Recommended ADRs

| ADR | Title | Priority |
|-----|-------|----------|
| ADR-0062 | People Maintenance Architecture | Required before implementation |
| ADR-0063 | Covenant Record Spiritual Profile Model | Required before wildcard Phase 4 |

---

## Implementation Scope Table

| Feature | Student | Staff/Faculty | Guardian | Applicant | Advisor |
|---------|:-------:|:-------------:|:--------:|:---------:|:-------:|
| List page with search | Phase 3 | Phase 3 | Phase 3 | Phase 3 | Phase 3 |
| Detail page shell | Phase 2 | Phase 2 | Phase 2 | Phase 2 | Phase 2 |
| View core profile | Phase 2 | Phase 2 | Phase 2 | Phase 2 | Phase 2 |
| Edit core person fields | Phase 2 | Phase 2 | Phase 2 | Phase 2 | Phase 2 |
| Edit type profile | Phase 2 | Phase 2 | Phase 2 | Phase 2 | Phase 2 |
| Create new record | Phase 1 | Phase 1 | Phase 2 | Phase 2 | N/A |
| Archive/deactivate | Phase 2 | Phase 2 | Phase 2 | N/A | N/A |
| Relationship management | Phase 2 | N/A | Phase 2 | N/A | N/A |
| Audit trail display | Phase 2 | Phase 2 | Phase 2 | Phase 2 | Phase 2 |
| Search and filter | Phase 3 | Phase 3 | Phase 3 | Phase 3 | Phase 3 |
| Role assignment from record | Phase 2 | Phase 2 | Phase 2 | N/A | N/A |
| Covenant Record tab | Phase 4 | Phase 4 | Phase 4 | Phase 4 | Phase 4 |
