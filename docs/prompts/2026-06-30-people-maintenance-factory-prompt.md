# Factory Prompt: People Maintenance System

Date: 2026-06-30
System: ChurchCore Academy (faith-based SIS)
Repository: `/Users/rjulia/ChurchCore Academy` (or wherever this repo is cloned)
Phase: Council Review IV — People Maintenance

---

## What You Are Building

You are implementing a corporate-grade people maintenance system for ChurchCore Academy's admin interface. This system adds full CRUD and profile maintenance for every person type: Students, Faculty/Staff/Teachers/Professors, Guardians, Applicants (pre-students), and Advisors. It also adds the Covenant Record — a faith-specific spiritual journey profile layer that no competing SIS offers.

The system currently has read-only admin UI for people and a narrow set of student mutations (student-self contact edits, registrar enrollment/advisor changes). You are building the admin-facing create, read, update, archive, and relationship management flows that institutions need to operate a faith-based school.

---

## Why This Matters

Faith-based institutions from children's schools to seminaries need to:
- Create and maintain accurate person records for all roles
- Manage guardian relationships with correct authority and visibility
- Track applicants through the admission pipeline
- View and reassign advisor loads
- Know the spiritual formation status of their community

ChurchCore Academy currently cannot do any of these through the UI. This implementation closes that gap and makes the system competitive with Populi, FACTS SIS, and similar products — while adding the Covenant Record as a faith-specific differentiator.

---

## Design Documents (Read All of These)

| Document | Location | Purpose |
|----------|----------|---------|
| CLAUDE.md | `/Users/rjulia/ChurchCore Academy/CLAUDE.md` | Architecture rules — mandatory |
| Council Review | `docs/reviews/council-review-4-people-maintenance.md` | Design rationale |
| ADR-0062 | `docs/adr/0062-people-maintenance-architecture.md` | Architecture decisions — follow these |
| ADR-0063 | `docs/adr/0063-covenant-record-spiritual-profile-model.md` | Covenant Record decisions |
| Design Spec | `docs/superpowers/specs/2026-06-30-people-maintenance-design.md` | Full field-level spec per person type |
| Implementation Plan | `docs/superpowers/plans/2026-06-30-people-maintenance.md` | Numbered tasks in dependency order |
| AI Worker Prompts | `docs/prompts/2026-06-30-people-maintenance-ai-prompts.md` | Per-concern worker prompts |

**Reference files (read for patterns — do not modify unless specified):**
- `src/modules/people/types.ts` — existing types
- `src/modules/people/access-policy.ts` — extend this
- `src/modules/people/validation.ts` — reuse helpers
- `src/modules/people/student-record-mutations.ts` — your mutation pattern
- `src/modules/academy-auth/policy.ts` — role definitions
- `src/modules/academy-config/types.ts` — add covenantRecords capability here
- `src/app/admin/students/[id]/page.tsx` — UI pattern reference
- `src/app/admin/settings/people/page.tsx` — replace with redirect

---

## Implementation Summary

### Phase 1: Core Infrastructure (build first — others depend on this)

**Files to create:**
- `src/modules/people/person-mutations.ts` — createPerson, updatePersonFields, archivePerson
- `src/modules/people/staff-mutations.ts` — createStaffProfile, updateStaffProfile, deactivateStaff
- `src/modules/people/relationship-mutations.ts` — createStudentRelationship, updateStudentRelationship, deactivateStudentRelationship
- `src/modules/people/guardian-mutations.ts` — createGuardianWithLink

**Files to modify:**
- `src/modules/people/access-policy.ts` — add 7 new PeopleAccessAction values and role sets

**API routes to create (`src/app/api/admin/`):**
- `people/[id]/route.ts` — PATCH (updatePersonFields), DELETE (archivePerson)
- `students/route.ts` — GET list, POST create
- `students/[id]/route.ts` — GET detail
- `students/[id]/person/route.ts` — PATCH
- `students/[id]/profile/route.ts` — PATCH
- `students/[id]/enrollment-status/route.ts` — PATCH with reason
- `staff/route.ts` — GET list, POST create
- `staff/[id]/route.ts` — GET detail
- `staff/[id]/person/route.ts` — PATCH
- `staff/[id]/profile/route.ts` — PATCH
- `guardians/route.ts` — GET list, POST create (person only)
- `guardians/[id]/route.ts` — GET detail
- `guardians/[id]/person/route.ts` — PATCH
- `guardians/[id]/relationships/route.ts` — POST create relationship
- `relationships/[id]/route.ts` — PATCH update, DELETE deactivate
- `applicants/route.ts` — GET list
- `applicants/[id]/route.ts` — GET detail
- `applicants/[id]/person/route.ts` — PATCH
- `applicants/[id]/status/route.ts` — PATCH (constrained enrollment statuses only)
- `advisors/route.ts` — GET list
- `advisors/[id]/route.ts` — GET detail
- `advisors/[id]/person/route.ts` — PATCH

**Tests to create (`src/modules/people/__tests__/`):**
- `access-policy.test.ts`
- `person-mutations.test.ts`
- `staff-mutations.test.ts`
- `relationship-mutations.test.ts`
- `guardian-mutations.test.ts`

### Phase 2: Detail Pages

**Files to create (`src/app/admin/people/`):**
- `page.tsx` — People Hub (tabbed; Overview + 5 type tabs)
- `students/page.tsx` — student list
- `students/[id]/page.tsx` — student detail (5 tabs: Profile, Enrollment, Relationships, Academic, Audit)
- `students/[id]/PersonEditDrawer.tsx` — client component drawer
- `students/[id]/EnrollmentStatusModal.tsx` — client component modal
- `staff/page.tsx` — staff list
- `staff/[id]/page.tsx` — staff detail (5 tabs)
- `staff/[id]/StaffEditDrawer.tsx` — client component
- `staff/[id]/EmploymentStatusModal.tsx` — client component
- `guardians/page.tsx` — guardian list
- `guardians/[id]/page.tsx` — guardian detail (5 tabs)
- `guardians/[id]/RelationshipModal.tsx` — client component (create/edit relationship)
- `applicants/page.tsx` — applicant list
- `applicants/[id]/page.tsx` — applicant detail (3 tabs)
- `advisors/page.tsx` — advisor list
- `advisors/[id]/page.tsx` — advisor detail (3 tabs)
- `src/components/create-person-modal.tsx` — shared two-step create modal

**Files to modify:**
- `src/app/admin/settings/people/page.tsx` — add redirect to `/admin/people`

### Phase 3: Navigation

**Files to modify:**
- `src/components/admin-shell.tsx` — add People link to nav pointing to `/admin/people`
- `src/app/admin/people/page.tsx` — wire tab metric cards with server-side counts

### Phase 4: Covenant Record

**Files to create:**
- `supabase/migrations/[timestamp]_covenant_records.sql` — new table
- `src/modules/people/covenant-mutations.ts` — upsertCovenantRecord, getCovenantRecord
- `src/app/api/admin/people/[id]/covenant/route.ts` — GET, PUT
- `src/components/covenant-record-tab.tsx` — client component tab

**Files to modify:**
- `src/modules/people/types.ts` — add CovenantFields, CovenantRecord types
- `src/modules/academy-config/types.ts` — add `covenantRecords: boolean` to InstitutionCapabilitySet
- All 5 person detail pages — add CovenantRecordTab

**Tests to create:**
- `src/modules/people/__tests__/covenant-mutations.test.ts`

---

## Critical Rules (From CLAUDE.md and ADR-0062)

1. **Business logic lives in `src/modules/people/`.** API routes stay thin: requireActor → call module function → map errors to HTTP status codes. Never put validation or audit logic in route handlers.

2. **Every mutation function must call `assertTenantIsolation(actor, actor.tenantId)` first.** The target person's tenant_id must be verified against actor.tenantId before any mutation. Cross-tenant mismatch throws Forbidden.

3. **Audit every mutation.** Use the `emitAuditEvent` pattern from `student-record-mutations.ts`. SHA-256 hash old values of: email, phone, date_of_birth, given_name, family_name, display_name, guardian relationship authority and visibility. Never store PII old values in plain text in audit events.

4. **Use SHA-256 for old-value hashing in audit.**
   ```typescript
   import crypto from 'node:crypto';
   function sha256Hash(value: string): string {
     return crypto.createHash('sha256').update(value).digest('hex');
   }
   ```

5. **No `any` type unless the existing file already uses it.**

6. **Tests use `node:test` + `node:assert/strict`. No Jest, no Vitest.**

7. **Every test file must include:**
   ```typescript
   assert.doesNotMatch(JSON.stringify(result), /credentialSecret|accessToken|refreshToken|password/);
   ```

8. **Every module function needs three tests: success case, validation/rejection case, cross-tenant rejection case.**

9. **Admin routes use `/api/admin/` namespace. Never put admin mutations under `/api/academy/`.**

10. **The `CovenantRecord.covenantFields.notes` field must be stripped from the response for any actor without institution_admin, dean, or academic_admin role.** This is a hard access rule, not a soft UI rule.

11. **CSS classes:** Define CSS classes before using them in JSX. Check `src/app/globals.css` and component CSS files for existing classes. Do not introduce inline styles.

12. **Do not break existing pages.** The `/admin/students/[id]` page, `/admin/staff` page, and all other existing pages must continue to work.

---

## Role Sets (from ADR-0062)

```typescript
const personWriteRoles = new Set<AcademyRole>(["institution_admin", "registrar"]);
const personAdminRoles = new Set<AcademyRole>(["institution_admin"]);
const staffWriteRoles = new Set<AcademyRole>(["institution_admin", "dean", "academic_admin"]);
const guardianWriteRoles = new Set<AcademyRole>(["institution_admin", "registrar", "admissions"]);
const relationshipWriteRoles = new Set<AcademyRole>(["institution_admin", "registrar"]);
const applicantReadRoles = new Set<AcademyRole>(["institution_admin", "registrar", "admissions", "academic_admin", "dean"]);
const applicantWriteRoles = new Set<AcademyRole>(["institution_admin", "registrar", "admissions"]);
const advisorLoadReadRoles = new Set<AcademyRole>(["institution_admin", "dean", "academic_admin", "registrar"]);
const peopleReadRoles = new Set<AcademyRole>(["institution_admin", "dean", "registrar", "academic_admin", "admissions"]);
```

---

## Input Type Reference

```typescript
interface CreatePersonInput {
  displayName: string;
  givenName?: string;
  familyName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  personStatus?: PersonStatus;  // default: 'active'
}

interface UpdatePersonInput {
  displayName?: string;
  givenName?: string;
  familyName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  personStatus?: PersonStatus;
  reason?: string;  // required when changing personStatus
}

interface CreateStaffProfileInput {
  title: string;
  primaryRole: StaffPrimaryRole;
  employmentStatus: StaffEmploymentStatus;
  primarySubdivisionId?: string;
  loadPolicy?: string;
}

interface UpdateStaffProfileInput {
  title?: string;
  primaryRole?: StaffPrimaryRole;
  primarySubdivisionId?: string | null;
  employmentStatus?: StaffEmploymentStatus;
  loadPolicy?: string | null;
  reason?: string;  // required when changing employmentStatus to inactive or archived
}

interface CreateRelationshipInput {
  studentPersonId: string;
  relatedPersonId: string;
  relationshipType: StudentRelationshipType;
  authority: StudentRelationshipAuthority;
  visibility: StudentRelationshipVisibility;
  startsOn?: string;
  endsOn?: string;
}

interface UpdateRelationshipInput {
  authority?: StudentRelationshipAuthority;
  visibility?: StudentRelationshipVisibility;
  status?: StudentRelationshipStatus;
  startsOn?: string;
  endsOn?: string;
  reason?: string;  // required when changing authority
}

interface CreateGuardianWithLinkInput extends CreatePersonInput {
  studentPersonId: string;
  relationshipType: StudentRelationshipType;  // typically 'guardian' or 'parent'
  authority: StudentRelationshipAuthority;
  visibility: StudentRelationshipVisibility;
}
```

---

## Verification Commands

After completing each phase, run:

```
npm test
npm run lint
npm run build
```

All three must pass with zero errors before the phase is complete.

---

## Delivery Format

When you finish, return:

1. A list of every file created (path only)
2. A list of every file modified (path + what changed)
3. Test count: `N tests, N passing`
4. Build result: `npm run build` — clean / errors (list errors if any)
5. Any items explicitly deferred and why

Do not summarize what the code does. Report what was built and whether it passes verification.

---

## Out of Scope

The following are explicitly out of scope for this implementation:

- Bulk person import (CSV/Excel)
- Password reset or auth account creation (use existing invite flow)
- Admissions decision workflow (use `/admin/admissions` for that)
- FERPA consent management UI (stub with "available when module enabled")
- Notification preference UI for guardians (stub)
- Moodle/Canvas account link creation (use existing LMS integration routes)
- ShepherdAI signal updates for people changes (ShepherdAI reads the existing data)
- Any change to the student PWA or guardian PWA routes
