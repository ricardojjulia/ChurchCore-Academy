# ADR 0062: People Maintenance Architecture

Date: 2026-06-30
Status: proposed

---

## Context

ChurchCore Academy's people module (`src/modules/people/`) currently supports only read operations and a narrow set of student mutations (student-self contact updates, registrar enrollment updates, advisor notes, and holds). There is no admin-facing flow for creating, editing, or archiving any person type. The admin UI for people is read-only.

As the SIS grows toward competitive completeness, every faith-based institution requires full lifecycle management for students, faculty, guardians, applicants, and advisors. The system must define how these person types are structured, who may edit each, and what audit trail is required.

The previous ADR-0008 established the role assignment and permission model. ADR-0049 established student-editable fields. This ADR governs the admin-facing mutation layer that completes the system.

---

## Decision

### 1. Person Type Taxonomy

ChurchCore Academy recognizes five person types in the admin maintenance system:

**Student** — a `Person` with an active `student` role assignment and an `academy_student_profiles` record. Subtypes: child, adult, dual_enrollment, seminary_student, bible_school_student, college_student, university_student.

**Staff** (comprising Professor, Faculty, Teacher, and administrative roles) — a `Person` with an active non-student, non-guardian `AcademyRole` and an `academy_staff_profiles` record. The staff profile's `primaryRole` field distinguishes the subtype. No separate schema table per subtype.

**Guardian** — a `Person` with an active `guardian` role assignment scoped to a specific student, backed by an active `StudentRelationship`. Guardians are created as bare persons first, then linked via relationship.

**Applicant** — a `Person` with a `StudentProfile` in `application_started` or `pending` enrollment status. Applicants are a filtered view of the student list, not a separate entity. The Applicant admin panel is a read/edit surface scoped to pre-enrollment persons.

**Advisor** — a `Person` with one or more active advisor-capable role assignments (`advisor`, `faculty`, `professor`, `dean`, `academic_admin`). Advisors are a filtered view of the people list. No separate profile table. Advisor load is computed from the `advisor_person_id` field on `academy_student_profiles`.

### 2. Module Structure

All people business logic resides in `src/modules/people/`. The module grows by adding new sub-files; it does not split into role-specific sub-modules.

New files:
- `person-mutations.ts` — admin create/update/archive of the core `Person` record
- `staff-mutations.ts` — admin create/update/deactivate of `StaffProfile`
- `guardian-mutations.ts` — admin create/link/update of guardian `Person` + `StudentRelationship`
- `relationship-mutations.ts` — create/update/deactivate `StudentRelationship` records

Existing files that already handle a subset of mutations continue unchanged:
- `student-record-mutations.ts` — student-self contact edits, registrar enrollment/advisor/program, holds, advisor notes

### 3. Edit Permission Model

The following role sets govern admin mutations. These extend `access-policy.ts`:

| Action | Allowed Roles |
|--------|---------------|
| `write_person` (core fields: name, email, phone, DOB, status) | institution_admin, registrar |
| `admin_person` (archive, delete) | institution_admin |
| `write_staff` (staff profile fields) | institution_admin, dean, academic_admin |
| `write_guardian` (guardian person + relationship create) | institution_admin, registrar, admissions |
| `write_relationship` (authority, visibility, status on existing relationships) | institution_admin, registrar |
| `read_applicant` (filtered student list by pre-enrollment status) | institution_admin, registrar, admissions, academic_admin, dean |
| `write_applicant` (applicant person fields before admission) | institution_admin, registrar, admissions |
| `read_advisor_load` (advisor's assigned student list) | institution_admin, dean, academic_admin, registrar |

The existing role sets for `write_student` (institution_admin, registrar, admissions) remain unchanged.

Cross-tenant isolation is asserted before every query. Tenant mismatch returns Forbidden, not Not Found.

### 4. API Route Namespace

Admin-only mutation routes use the `/api/admin/` namespace. Student-facing routes remain in `/api/academy/`. This prevents confusion about which routes are actor-scoped vs. admin-scoped.

New route namespace: `src/app/api/admin/`

### 5. Audit Requirements

Every admin mutation on a person record must emit to `academy_audit_events` with:
- `actor_person_id` — the admin performing the change
- `action` — e.g., `create_person`, `update_person`, `archive_person`, `create_relationship`, `update_relationship_authority`
- `entity_type` — `person`, `student_profile`, `staff_profile`, `student_relationship`
- `entity_id` — the affected record's ID
- `result_status` — `success` (only emit on success)
- `redacted_metadata` — JSONB with `field_changed`, `old_value_hash` (SHA-256 of sensitive old values), `new_value` (for non-sensitive fields), and `reason` (where required by policy)

**Fields requiring hash-only audit (old value stored as SHA-256, not plain text):**
- `email`, `phone`, `date_of_birth`, `display_name`, `given_name`, `family_name`
- Guardian relationship `authority` and `visibility` old values

**Fields where new value is logged in plain text:**
- `person_status`, `enrollment_status`, `employment_status`, `student_type`, `student_number`, `staff_number`
- Guardian relationship `status`, `starts_on`, `ends_on`

**Reason required for:**
- Person archive
- Enrollment status change
- Guardian relationship authority change
- Staff employment status deactivation

### 6. Person Creation Flow

Creating a new person follows a two-phase process:

Phase 1: Insert `academy_people` row. Generate UUID server-side. Validate: non-empty `displayName`, unique email within tenant (case-insensitive).

Phase 2: Insert type-specific profile. For Student: generate `student_number`, set `student_type` and `enrollment_status`. For Staff: generate `staff_number`, set `title`, `primaryRole`, `employmentStatus`. For Guardian: create `StudentRelationship` after person insert.

Role assignment is always created after both phases complete.

### 7. Person Archive

Archive sets `person_status = 'archived'` on the `academy_people` row. It does NOT delete the record. Before archiving, the system must verify: no active student enrollments, no active staff assignments, no active guardian relationships. If any exist, the archive is rejected with a descriptive error.

Role assignments are not automatically deactivated on archive — this is a deliberate decision to preserve the audit trail. Deactivation of role assignments is a separate admin action.

### 8. Guardian Relationship Create

Creating a guardian relationship requires:
1. A valid, active `guardian` or `parent` relationship type
2. The student person to exist and be active in the same tenant
3. The guardian person to exist and be active in the same tenant
4. Authority must be one of the defined `StudentRelationshipAuthority` values
5. Visibility must be one of the defined `StudentRelationshipVisibility` values
6. Contact-only types cannot use guardian-level visibility (existing validation rule)

After creating the relationship, the system creates an `academy_person_role_assignments` row for the guardian person scoped to the student.

---

## Consequences

**Easier:**
- Admins can create, edit, and archive any person type without database-level intervention
- The people module has a complete, consistent audit trail for all person-level changes
- Faith-based institutions can manage guardian relationships, advisor loads, and applicant pipelines from a single admin surface
- The access-policy module has explicit write actions for all person types

**Harder:**
- More files to maintain in the people module
- Every new mutation must be tested for success, validation, and cross-tenant rejection cases
- The admin route namespace (`/api/admin/`) must be consistently enforced — no admin mutations should appear under `/api/academy/`

**Safer:**
- Explicit role sets per mutation type reduce the chance of accidental privilege escalation
- Hashed-old-value audit pattern preserves accountability without storing PII in plain text
- Archive-before-delete policy prevents accidental data loss

**Riskier:**
- Guardian relationship creation is a high-consequence operation — wrong authority/visibility settings affect student privacy. This is mitigated by explicit validation and required reason for authority changes.

---

## Alternatives Considered

**Role-specific sub-modules (e.g., `src/modules/students/`, `src/modules/guardians/`):** Rejected. Would create cross-module dependencies (student references guardian references person). A single `src/modules/people/` with sub-files is cleaner and matches the existing pattern.

**Extending the existing `postgres-repository.ts` with mutations:** Rejected. `AcademyPeopleRepository` is a read-focused class. Mutations belong in dedicated function-based files following the `student-record-mutations.ts` pattern, which is more testable and composable.

**Re-using the staff invite flow for all person creation:** Rejected. The invite flow is email-driven and creates a Supabase auth user. Admin creation of a person record is a SIS operation that may not involve auth account creation (e.g., creating a guardian record for a non-user parent, or a historical student record).

---

## Review Notes

- **Product boundary:** All changes confined to `src/modules/people/`, `src/app/api/admin/`, and `src/app/admin/people/`. No LMS code touched.
- **Security/privacy:** Audit requirements above are mandatory. SHA-256 hash pattern matches ADR-0019 (immutable audit events).
- **Testing:** Every mutation function requires success, validation, and cross-tenant rejection tests. Guardian relationship tests must verify contact-only type cannot use guardian-level visibility.
- **Rollback:** Person archive is reversible by institution_admin (set status back to active). Relationship deactivation is reversible. There is no hard delete; rollback is always available.
