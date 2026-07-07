# Design Specification: People Maintenance System

Date: 2026-06-30
ADRs: 0062, 0063
Council Review: IV

---

## Overview

This specification defines the data model, API surface, validation rules, and UI layout for the people maintenance system in ChurchCore Academy. It covers five person types: Student, Staff/Faculty/Teacher/Professor, Guardian, Applicant, and Advisor. It also covers the People Hub navigation and the Covenant Record wildcard feature.

All implementation must follow ADR-0062 (architecture) and ADR-0063 (Covenant Record).

---

## People Hub Navigation

### Route

`/admin/people` — replaces the current `/admin/settings/people` as the primary people admin surface. The settings page redirects to `/admin/people`.

### Layout

The People Hub is a tabbed page under the `AdminShell` with `activeSection="records"`.

```
AdminShell
  eyebrow: "People"
  title: "People and Roles"
  subtitle: "Manage students, faculty, guardians, applicants, and advisors."

  Tabs (horizontal, top):
    Overview | Students | Faculty and Staff | Guardians | Applicants | Advisors

  Overview tab:
    [Existing PeopleMetricTiles]
    [Validation panel]
    [Role coverage grid]

  Each other tab:
    [Metric row: count + status breakdown]
    [Search bar]       [Status filter dropdown]    [+ New Person button]
    [Table or card list]
```

### Search and Filter

Each list tab loads all persons of that type for the tenant on page load. Client-side filter on `displayName`, `email`, `studentNumber`/`staffNumber` via a controlled text input. Status filter is a `<select>` or `<SegmentedControl>` with options appropriate to each type.

For large tenants (> 500 persons), server-side search via query parameter is used. The threshold is detected by checking `model.people.length > 500` and switching to a debounced API call.

### "New Person" Button

Opens a two-step modal:
- Step 1: Core person fields
- Step 2: Type-specific profile fields

Described per person type below.

---

## Person Type: Student

### Fields Owned by This Type

**Core person fields (editable by registrar, institution_admin):**

| Field | DB Column | Editable | Required | Notes |
|-------|-----------|----------|----------|-------|
| Display name | `display_name` | Yes | Yes | Auto-derived from given+family if provided |
| Given name | `given_name` | Yes | No | |
| Family name | `family_name` | Yes | No | |
| Preferred name | `preferred_name` | Yes | No | Used in student PWA |
| Email | `email` | Yes | No | Unique within tenant (case-insensitive) |
| Phone | `phone` | Yes | No | |
| Date of birth | `date_of_birth` | Yes | No | FERPA-protected; not shown in list view |
| Person status | `person_status` | Yes | Yes | active / inactive / invited / archived |
| Address (street, city, state, postal, country) | Various | Yes | No | Contact fields; student can self-edit via me/contact |
| Emergency contact (name, phone, relationship) | Various | Yes | No | |

**Student profile fields (editable by registrar, institution_admin):**

| Field | DB Column | Editable | Required | Notes |
|-------|-----------|----------|----------|-------|
| Student number | `student_number` | Read-only after creation | Yes | Generated server-side |
| Student type | `student_type` | Yes | Yes | child / adult / dual_enrollment / seminary_student / bible_school_student / college_student / university_student |
| Enrollment status | `enrollment_status` | Yes | Yes | Requires reason for change; audit-logged |
| Primary subdivision | `primary_subdivision_id` | Yes | No | |
| Grade band subdivision | `grade_band_subdivision_id` | Yes | No | Shown when institution uses grade levels |
| Program | `program_id` | Yes | No | Requires reason for change |
| Advisor | `advisor_person_id` | Yes | No | Must be person with advisor-capable role |
| Guardian required | `guardian_required` | Yes | Yes | Default: false for adult types; true for child |

**Read-only / derived:**
- `createdAt`, `updatedAt`
- GPA (computed by grading engine, read-only here)
- Guardian status (derived from active relationships)

### Validation Rules

- `displayName` must be non-empty after trim
- `email` must be unique within tenant (case-insensitive index enforced in DB)
- `studentType` must be one of the defined `StudentType` values
- `enrollmentStatus` must be one of the defined `StudentEnrollmentStatus` values
- `advisorPersonId` must reference a person with an active advisor-capable role in the same tenant
- If `studentType === 'child'` and `guardianRequired === true` and institution uses guardians, an active guardian relationship must exist
- Enrollment status change requires a non-empty `reason` string (max 500 chars)
- Person status change to `archived` requires no active enrollments (rejected with error if violated)

### API Endpoints

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/api/admin/students` | registrar, institution_admin, academic_admin, admissions, dean | — | List all student profiles for tenant |
| GET | `/api/admin/students/[id]` | registrar, institution_admin, academic_admin, admissions, dean | — | Get student + person + relationships |
| POST | `/api/admin/students` | institution_admin, registrar, admissions | `CreateStudentInput` | Create person + student profile + role assignment |
| PATCH | `/api/admin/students/[id]/person` | institution_admin, registrar | `UpdatePersonInput` | Update core person fields |
| PATCH | `/api/admin/students/[id]/profile` | institution_admin, registrar | `UpdateStudentProfileInput` | Update enrollment, program, advisor, subdivisions |
| PATCH | `/api/admin/students/[id]/enrollment-status` | institution_admin, registrar | `{ status, reason }` | Update enrollment status (audit-logged) |
| DELETE | `/api/admin/students/[id]` | institution_admin | `{ reason }` | Archive person (sets person_status to archived) |

### UI Panel Layout

**Route:** `/admin/people/students/[id]`

```
AdminShell
  Back link: "← All Students"
  Eyebrow: "Student"
  Title: [displayName]                               [Status badge]
  Actions: [Edit Profile] [Archive]

  Tabs: Profile | Enrollment | Relationships | Academic | Audit

  --- Profile tab ---
  Two-column form (read-only by default, Edit button opens drawer):
    Left column:
      Given name / Family name / Preferred name
      Email / Phone
      Date of birth (shown as "on file" if present; click reveals)
      Address block
    Right column:
      Student number (read-only)
      Student type
      Person status

  --- Enrollment tab ---
  Card: Enrollment
    Enrollment status [badge]   [Change status button → modal with reason field]
    Program name (link to program)
    Advisor name (link to advisor profile)
    Primary subdivision
    Grade band subdivision
    Guardian required: Yes/No
    Guardian status: "Guardian linked" / "Needs guardian" / "Not required"

  --- Relationships tab ---
  Table of active student relationships:
    Related person | Type | Authority | Visibility | Status | Actions
    [+ Add relationship button]
  Each row: [Edit] [Deactivate]

  --- Academic tab ---
  Links to:
    Open full student record → /admin/students/[id]
    (holds, advisor notes, registrations, ShepherdAI — existing page)

  --- Audit tab ---
  Chronological log from academy_audit_events
    Date | Actor | Action | Field changed | Reason
    (new value not shown; old value shown as "changed" or SHA-256 prefix for sensitive fields)
```

---

## Person Type: Staff / Faculty / Teacher / Professor

### Fields Owned by This Type

**Core person fields (same as Student above, editable by institution_admin, dean, academic_admin).**

**Staff profile fields:**

| Field | DB Column | Editable | Required | Notes |
|-------|-----------|----------|----------|-------|
| Staff number | `staff_number` | Read-only after creation | Yes | Generated server-side |
| Title | `title` | Yes | Yes | e.g., "Dr.", "Professor", "Mr.", "Rev." |
| Primary role | `primary_role` | Yes | Yes | Must be a valid non-student, non-guardian AcademyRole |
| Primary subdivision | `primary_subdivision_id` | Yes | No | |
| Employment status | `employment_status` | Yes | Yes | active / inactive / adjunct / volunteer / archived |
| Load policy | `load_policy` | Yes | No | e.g., "full_time", "part_time", "per_course" |

**Read-only / derived:**
- Course section assignments (from course catalog, linked read-only)
- `createdAt`, `updatedAt`

### Validation Rules

- `displayName` non-empty
- `title` non-empty
- `primaryRole` must be a `StaffPrimaryRole` (excludes `student` and `guardian`)
- `employmentStatus` change to `archived` requires reason; requires no active section assignments in current term (warning, not hard block)
- `email` unique within tenant

### API Endpoints

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/api/admin/staff` | institution_admin, dean, registrar, academic_admin | — | List staff profiles |
| GET | `/api/admin/staff/[id]` | institution_admin, dean, registrar, academic_admin | — | Get staff + person |
| POST | `/api/admin/staff` | institution_admin, dean, academic_admin | `CreateStaffInput` | Create person + staff profile + role assignment |
| PATCH | `/api/admin/staff/[id]/person` | institution_admin, dean, academic_admin | `UpdatePersonInput` | Update core person fields |
| PATCH | `/api/admin/staff/[id]/profile` | institution_admin, dean, academic_admin | `UpdateStaffProfileInput` | Update title, role, subdivision, load policy, status |
| DELETE | `/api/admin/staff/[id]` | institution_admin | `{ reason }` | Archive person |

### UI Panel Layout

**Route:** `/admin/people/staff/[id]`

```
AdminShell
  Back: "← Faculty and Staff"
  Title: [displayName]                               [Status badge]
  Actions: [Edit Profile] [Deactivate]

  Tabs: Profile | Assignment | Sections | Ministry Formation | Audit

  --- Profile tab ---
    Given/family/preferred name | Email | Phone | DOB (on file)
    Staff number (read-only) | Title | Primary role

  --- Assignment tab ---
  Card:
    Employment status [badge]   [Change status button → modal with reason]
    Primary subdivision
    Load policy
    [Edit Assignment button → drawer with subdivision + load policy fields]

  --- Sections tab ---
  Table (read-only):
    Course | Section | Term | Role (instructor/co-instructor/grader) | Status
    (links to course admin)

  --- Ministry Formation tab ---
  (Same ordination/denomination UI as on existing people/[id]/ordinations routes)

  --- Audit tab ---
  Audit event log for this staff profile
```

---

## Person Type: Guardian

### Fields Owned by This Type

**Core person fields (editable by institution_admin, registrar, admissions):**
Same set as Student above — no guardian-specific profile table.

**Guardian-specific data lives in `StudentRelationship` records:**

| Field | DB Column | Editable | Required | Notes |
|-------|-----------|----------|----------|-------|
| Relationship type | `relationship_type` | Yes | Yes | guardian / parent / emergency_contact / pickup_contact / advisor / mentor / etc. |
| Authority | `authority` | Yes | Yes | Audit-logged; reason required for changes |
| Visibility | `visibility` | Yes | Yes | |
| Status | `status` | Yes | Yes | active / inactive / expired |
| Starts on | `starts_on` | Yes | No | Date |
| Ends on | `ends_on` | Yes | No | Date |

**Sensitive guardian data:**
- FERPA restriction status — from `academy_guardian_ferpa_restrictions` (if the migration exists)
- Notification preferences — from `academy_notification_preferences`

### Validation Rules

- Guardian person must be active (not archived) before creating relationship
- Student person must be active (not archived) before creating relationship
- Contact-only types (`emergency_contact`, `pickup_contact`) cannot use guardian-level visibility
- `emergency_contact` cannot have `academic_decision` or `registration_decision` authority
- `pickup_contact` must use `pickup_authorized` or `none` authority
- Authority change requires reason
- At most one active `full_guardian` visibility relationship per student (warn, not block)

### API Endpoints

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/api/admin/guardians` | institution_admin, registrar, admissions, academic_admin, dean | — | List guardian persons |
| GET | `/api/admin/guardians/[id]` | institution_admin, registrar, admissions, academic_admin, dean | — | Guardian + relationships |
| POST | `/api/admin/guardians` | institution_admin, registrar, admissions | `CreateGuardianInput` | Create person (no relationship yet) |
| PATCH | `/api/admin/guardians/[id]/person` | institution_admin, registrar | `UpdatePersonInput` | Update core person fields |
| POST | `/api/admin/guardians/[id]/relationships` | institution_admin, registrar | `CreateRelationshipInput` | Link guardian to a student |
| PATCH | `/api/admin/relationships/[id]` | institution_admin, registrar | `UpdateRelationshipInput` | Update authority / visibility / status |
| DELETE | `/api/admin/relationships/[id]` | institution_admin, registrar | `{ reason }` | Deactivate relationship |

### UI Panel Layout

**Route:** `/admin/people/guardians/[id]`

```
AdminShell
  Back: "← Guardians"
  Title: [displayName]                               [Status badge]
  Actions: [Edit Profile]

  Tabs: Profile | Students | FERPA / Privacy | Notification Preferences | Audit

  --- Profile tab ---
    Given/family/preferred name | Email | Phone | DOB (on file)

  --- Students tab ---
  For each linked student relationship:
  Card:
    Student name (link to student record)
    Relationship type | Authority | Visibility
    Status [badge] | Starts / Ends dates
    [Edit relationship] [Deactivate]
  [+ Link to student button → modal: search student + set type/authority/visibility]

  --- FERPA / Privacy tab ---
  FERPA restriction status (if migration exists)
  Restriction history log

  --- Notification Preferences tab ---
  Linked notification preferences if any

  --- Audit tab ---
  Audit log including relationship create/edit/deactivate events
```

---

## Person Type: Applicant

An Applicant is a `Person` with a `StudentProfile` where `enrollmentStatus` is `application_started` or `pending`. No separate entity.

### Fields

Applicant panel edits the same `Person` and `StudentProfile` fields as Student, but the enrollment status is constrained to pre-admission values (`application_started`, `pending`, `admitted`). Editing to `active` is the admission conversion and handled separately.

**Additional applicant-context fields (read-only, from admissions module):**
- Application document checklist completion percentage
- Admission decision status (if `academy_admissions_applications` table exists)
- Application started date

### Validation Rules

- Same core person validation as Student
- Enrollment status restricted to: `application_started`, `pending`, `admitted` (cannot be set to `active`, `graduated`, `withdrawn` through the Applicant panel — those transitions go through the admissions/enrollment conversion flow)

### API Endpoints

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/api/admin/applicants` | institution_admin, registrar, admissions, academic_admin, dean | — | List persons with applicant-range enrollment status |
| GET | `/api/admin/applicants/[id]` | institution_admin, registrar, admissions, academic_admin, dean | — | Applicant + person + application context |
| PATCH | `/api/admin/applicants/[id]/person` | institution_admin, registrar, admissions | `UpdatePersonInput` | Update core person fields |
| PATCH | `/api/admin/applicants/[id]/status` | institution_admin, registrar, admissions | `{ status, reason }` | Change applicant enrollment status (constrained) |

### UI Panel Layout

**Route:** `/admin/people/applicants/[id]`

```
AdminShell
  Back: "← Applicants"
  Title: [displayName]                               [Enrollment status badge]
  Actions: [Edit Profile] [Convert to Enrolled → /admin/admissions/...]

  Tabs: Profile | Application | Audit

  --- Profile tab ---
  Core person fields (edit via drawer)

  --- Application tab ---
  Card:
    Enrollment status [badge]  [Change status → modal with reason]
    Student type
    Document checklist: X / Y complete
    Application started: [date]
    Admission decision: [status if available]
  Link: Open full application → /admin/admissions/[applicationId]

  --- Audit tab ---
  Audit log for person and enrollment status changes
```

---

## Person Type: Advisor

An Advisor is a `Person` with one or more active advisor-capable role assignments (`advisor`, `faculty`, `professor`, `dean`, `academic_admin`). No separate profile table.

### Fields

Advisor panel shows core `Person` fields plus:

| Derived | Source | Notes |
|---------|--------|-------|
| Advisor-capable roles | `academy_person_role_assignments` | Listed as badges |
| Assigned students | `academy_student_profiles.advisor_person_id` | Count + list |

### Validation Rules

- Person must have at least one active advisor-capable role to appear in Advisor panel
- Core person field edits follow the same rules as Staff

### API Endpoints

| Method | Path | Auth | Body | Purpose |
|--------|------|------|------|---------|
| GET | `/api/admin/advisors` | institution_admin, registrar, academic_admin, dean | — | List persons with advisor-capable roles + student load count |
| GET | `/api/admin/advisors/[id]` | institution_admin, registrar, academic_admin, dean | — | Advisor person + roles + assigned students |
| PATCH | `/api/admin/advisors/[id]/person` | institution_admin, registrar | `UpdatePersonInput` | Update core person fields (shared with staff path) |

### UI Panel Layout

**Route:** `/admin/people/advisors/[id]`

```
AdminShell
  Back: "← Advisors"
  Title: [displayName]
  [Role badges: advisor, faculty, etc.]

  Tabs: Profile | Assigned Students | Audit

  --- Profile tab ---
  Core person fields (edit via drawer)
  Advisor-capable roles (read-only, managed via role assignment)
  [Manage roles → /admin/settings/people overview role assignment form]

  --- Assigned Students tab ---
  Table:
    Student | Enrollment status | Program | Since
    (link to student record)
  Count: [N] assigned students

  --- Audit tab ---
  Audit log for person field changes
```

---

## Shared: Role Assignment from Person Record

Every person detail page includes a "Roles" section (collapsible, beneath the tab panel or within the Profile tab). It shows active role assignments and has a "+ Assign Role" button that opens the existing `RoleAssignmentForm` component, pre-populated with the current person's ID.

---

## Shared: Audit Log Display

Every person detail page has an Audit tab. The audit log query:

```sql
select action, entity_type, entity_id, actor_person_id, result_status,
       redacted_metadata, created_at
from academy_audit_events
where tenant_id = $1
  and entity_id = $2
order by created_at desc
limit 100
```

Display format per entry:
```
[Date/time]  [Actor name]  [Action label]  [Field changed]  [Reason if present]
```

Old values: display "changed (previous value hashed)" for sensitive fields. New values: display as plain text for non-sensitive fields.

---

## Shared: Create Person Modal

Two-step modal, consistent across all person types that support creation:

**Step 1 — Core person:**
```
Field: Display name (required)
Field: Given name
Field: Family name
Field: Email (unique within tenant)
Field: Phone
Field: Date of birth
Field: Person status (default: active)
[Next →]
```

**Step 2 — Type profile:**

For Student:
```
Field: Student type (required)
Field: Enrollment status (default: application_started)
Field: Primary subdivision (optional)
[Create student]
```

For Staff:
```
Field: Title (required)
Field: Primary role (required) [select from AcademyRole non-student/guardian options]
Field: Employment status (default: active)
Field: Primary subdivision
[Create staff member]
```

For Guardian:
```
Field: Link to student (search existing students)
Field: Relationship type (guardian / parent / emergency_contact / pickup_contact / other)
Field: Authority (required)
Field: Visibility (required)
[Create guardian and link]
```

On submit: POST to the appropriate `/api/admin/[type]` endpoint. On success: navigate to the new person's detail page.

---

## Covenant Record Tab (Phase 4, ADR-0063)

Shown on every person type detail page when `institutionProfile.capabilities.covenantRecords === true`.

```
--- Covenant Record tab ---
Card: Spiritual Journey
  Faith decision date: [date or "Not recorded"]
  Baptism date: [date or "Not recorded"]
  Baptism form: [Immersion / Sprinkling / Affusion / Other]
  Home church: [name, city]

Card: Institutional Covenant
  Covenant status: [Not signed / Signed / Renewed / Inactive]
  Signed date: [date]
  Witness: [name]
  Formation track: [track label]

Card: Notes (visible to institution_admin, dean, academic_admin only)
  [text area, max 1000 chars]

[Edit Covenant Record] — opens drawer
```

---

## Sensitive Fields Summary

| Field | List view | Detail view | Audit |
|-------|-----------|-------------|-------|
| date_of_birth | Hidden | "On file" (reveal on click) | Old value hashed |
| email | Shown | Shown | Old value hashed |
| phone | Hidden | Shown | Old value hashed |
| display_name | Shown | Shown | Old value hashed |
| guardian relationship authority | Admin only | Admin only | Old value hashed + reason required |
| advisor notes (notes field) | Never | Admin roles only | Old value hashed |
| covenant record notes | Never | Admin roles only | Old value hashed |

---

## Input Types Reference

```typescript
interface UpdatePersonInput {
  displayName?: string;
  givenName?: string;
  familyName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;   // YYYY-MM-DD
  personStatus?: PersonStatus;
  reason?: string;        // required when changing personStatus
}

interface UpdateStudentProfileInput {
  studentType?: StudentType;
  primarySubdivisionId?: string | null;
  gradeBandSubdivisionId?: string | null;
  programId?: string | null;
  advisorPersonId?: string | null;
  guardianRequired?: boolean;
  reason: string;         // always required for student profile updates
}

interface UpdateStaffProfileInput {
  title?: string;
  primaryRole?: StaffPrimaryRole;
  primarySubdivisionId?: string | null;
  employmentStatus?: StaffEmploymentStatus;
  loadPolicy?: string | null;
  reason?: string;        // required when changing employmentStatus
}

interface CreateRelationshipInput {
  studentPersonId: string;
  relatedPersonId: string;
  relationshipType: StudentRelationshipType;
  authority: StudentRelationshipAuthority;
  visibility: StudentRelationshipVisibility;
  startsOn?: string;      // YYYY-MM-DD
  endsOn?: string;        // YYYY-MM-DD
}

interface UpdateRelationshipInput {
  authority?: StudentRelationshipAuthority;
  visibility?: StudentRelationshipVisibility;
  status?: StudentRelationshipStatus;
  startsOn?: string;
  endsOn?: string;
  reason?: string;        // required when changing authority
}
```
