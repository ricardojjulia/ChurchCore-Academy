# People, Roles, Guardians, And Faculty Design

## Factory Intake

Feature: Phase 4, Sprint 1 people, roles, guardians, and faculty design package.

Product area: People Directory, Role Boundaries, Guardian Relationships, Faculty/Teacher Assignment, and Student Visibility.

Primary users:

- institution administrators
- deans and academic administrators
- registrar and admissions staff
- advisors
- teachers, professors, faculty, and instructional staff
- students
- guardians for children's school mode
- implementation consultants
- future Codex, GitHub Copilot, and Claude Code agents working in this repo

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched in this sprint: documentation only.

LMS provider impact: defines future person identity and instructional-role references that Moodle, Canvas, and no-LMS adapters can consume later. It does not implement LMS identity, SSO, roster sync, launch, or provider credentials.

Student PWA impact: establishes future student and guardian visibility boundaries for schedules, courses, documents, grades, progress, messages, and LMS launch.

ShepherdAI impact: establishes future Academy-owned people/setup signals for missing instructor assignment, advisor load, guardian consent gaps, staff role conflicts, and student action reminders. It does not allow LMS engagement, spiritual condition, counseling, giving, or devotional signals.

Auth and privacy risks: this domain contains student records, minor/guardian relationships, staff permissions, and future student PWA exposure. Future implementation must use tenant-scoped reads and writes, relationship-scoped guardian access, least-privilege roles, and auditable permission changes.

## Current Context

Phase 1 established tenant-level institution configuration, operating rules, API read paths, admin review UI, and a central institution configuration access policy.

Phase 2 established academic calendars, periods, and institution subdivisions.

Phase 3 established course catalogs, sections, duration rules, provider-neutral LMS mappings, API read path, and admin setup review UI.

The current code already includes a small bootstrap role set in `src/modules/academy-auth/policy.ts`:

- `institution_admin`
- `dean`
- `registrar`
- `academic_admin`
- `admissions`
- `advisor`
- `faculty`
- `teacher`
- `professor`
- `student`
- `guardian`

Those names are useful, but the existing policy only answers institution configuration access. Phase 4 must define the broader people and relationship model before assignment workflows, student PWA access, guardian access, and LMS identity mapping are built.

## Problem

ChurchCore Academy cannot model people as only "users" or only "students." Faith-based institutions need overlapping roles and relationships:

- A Bible school may have volunteer instructors, ministry mentors, cohort leaders, advisors, and adult students.
- A children's school requires guardians, consent authority, pickup/contact relationships, grade-band visibility, and teacher-led classes.
- A seminary may need professors, field education supervisors, advisors, deans, and graduate students.
- A college may need faculty, adjunct professors, registrar staff, admissions staff, advisors, and student workers.
- A university may need multiple schools, departments, campuses, instructors, teaching assistants, and role scope by subdivision.
- A mixed institution may have one person who is a guardian, staff member, and student in different contexts.

If Academy collapses these into a single flat role or ties every permission directly to a login account, future student PWA, guardian access, instructor assignment, LMS sync, and audit behavior will become brittle.

## Design Goals

1. Separate a person identity from authentication accounts and role assignments.
2. Allow one person to hold multiple roles in the same tenant.
3. Scope staff and instructional roles by tenant and optionally by subdivision.
4. Support students, guardians, teachers, professors, faculty, advisors, admissions, registrar staff, academic administrators, deans, and institution administrators.
5. Model guardian relationships as relationships to specific students, not tenant-wide student access.
6. Support adult students without guardian requirements.
7. Support children's school guardian requirements when institution operating rules require guardians.
8. Provide stable person references for course sections, advising, enrollment, grading, student PWA, and LMS identity mapping.
9. Keep provider identity mapping out of the people core until the LMS contract phase.
10. Make future validation deterministic and testable.

## Non-Goals

- Do not implement TypeScript people types in this sprint.
- Do not implement database tables or migrations in this sprint.
- Do not implement people APIs or repositories in this sprint.
- Do not implement people admin UI in this sprint.
- Do not implement instructor assignment workflows in this sprint.
- Do not implement guardian portal or student PWA behavior in this sprint.
- Do not implement Supabase Auth, SSO, Moodle identity mapping, or Canvas identity mapping in this sprint.
- Do not implement grade, transcript, attendance, discipline, counseling, giving, or pastoral care permissions in this sprint.
- Do not store provider tokens, LMS passwords, or OAuth credentials on person records.

## Options Considered

### Option A: Account-Centric Users

Model each person as an authenticated user account with roles directly attached.

Pros:

- simple for admin staff
- maps naturally to login sessions
- easy to use in early API checks

Cons:

- weak fit for children without login accounts
- weak fit for guardians who relate to specific students
- hard to represent inactive people, applicants, emergency contacts, or future staff
- couples identity records to authentication provider behavior

Decision: rejected.

### Option B: Student And Staff Tables Only

Keep separate student, faculty, and administrator records with no shared person model.

Pros:

- simple reporting by audience
- close to the current mock dataset
- easy to understand for early UI surfaces

Cons:

- duplicates name, email, contact, status, and tenant fields
- struggles when one person has several roles
- complicates LMS identity mapping
- makes guardian and staff-student overlaps hard to audit

Decision: rejected.

### Option C: Person Core Plus Role Assignments

Use a durable tenant-scoped `Person` record, then attach scoped role assignments and relationship records.

Pros:

- supports multiple roles per person
- supports students without login accounts and staff with login accounts
- supports guardian relationships to specific students
- gives LMS, PWA, advising, courses, and grading stable person references
- keeps authorization deterministic and testable

Cons:

- requires more validation than a flat role list
- requires clear UI wording so administrators understand person, role, and relationship distinctions

Decision: accepted.

### Option D: Relationship Graph For Everything

Represent all people, roles, guardians, staff assignments, advising, teaching, and contacts as generic relationship edges.

Pros:

- highly flexible
- can model unusual institutional structures

Cons:

- too vague for permission checks
- makes privacy review and validation harder
- increases risk of accidental guardian or student data exposure

Decision: rejected.

## Accepted Design

ChurchCore Academy will model people with four cooperating concepts:

1. Person: durable tenant-scoped human identity.
2. Role assignment: what a person may do in a tenant and, where needed, in a subdivision.
3. Student profile and staff profile: role-specific academic and employment/instructional metadata.
4. Student relationship: guardian, emergency contact, advisor, mentor, and other person-to-student relationships with explicit visibility rules.

Authentication accounts are external to this core model. A future account link can connect a person to Supabase Auth, Moodle, Canvas, or another identity provider, but authentication provider records do not define the Academy person model.

## Domain Model

### Person

Purpose: tenant-scoped identity for a human being known to the institution.

Fields:

- `id`
- `tenantId`
- `displayName`
- `givenName`
- `familyName`
- `preferredName`
- `email`
- `phone`
- `dateOfBirth`
- `personStatus`
- `createdAt`
- `updatedAt`

Person status values:

- `active`
- `inactive`
- `invited`
- `archived`

Rules:

- `tenantId` is required.
- Display names must not be empty.
- Email may be absent for children, emergency contacts, and imported historical records.
- Email uniqueness is tenant-scoped when present.
- A person may exist before login access is granted.
- Archived people remain referenceable by historical records.

### PersonRoleAssignment

Purpose: assign one or more Academy roles to a person.

Fields:

- `id`
- `tenantId`
- `personId`
- `role`
- `scopeType`
- `scopeId`
- `status`
- `startsOn`
- `endsOn`
- `createdAt`
- `updatedAt`

Role values:

- `institution_admin`
- `dean`
- `registrar`
- `academic_admin`
- `admissions`
- `advisor`
- `faculty`
- `teacher`
- `professor`
- `student`
- `guardian`

Scope types:

- `tenant`
- `subdivision`
- `course_section`
- `student`

Rules:

- A role assignment must belong to the same tenant as the person.
- Institution-wide administrative roles use `tenant` scope.
- Teacher, professor, faculty, dean, and academic administrator roles may optionally be subdivision-scoped.
- Advisor roles may be tenant-scoped or student-scoped through advising relationships.
- Guardian role assignment alone does not grant access to every child in the tenant; guardian access requires an active student relationship.
- Student role assignment must be paired with a student profile before the student PWA exposes academic records.
- Expired assignments must not authorize current access.

### StudentProfile

Purpose: student-specific academic identity for a person.

Fields:

- `id`
- `tenantId`
- `personId`
- `studentNumber`
- `studentType`
- `enrollmentStatus`
- `primarySubdivisionId`
- `gradeBandSubdivisionId`
- `programId`
- `advisorPersonId`
- `guardianRequired`
- `createdAt`
- `updatedAt`

Student type values:

- `child`
- `adult`
- `dual_enrollment`
- `seminary_student`
- `bible_school_student`
- `college_student`
- `university_student`

Rules:

- A student profile must reference a person in the same tenant.
- Children's school students must have `studentType = child`.
- Children's school students require guardian review when the institution operating rules require guardians.
- Adult Bible school, seminary, college, and university students do not require guardian relationships unless the institution explicitly configures a special program rule later.
- Student numbers are tenant-scoped.
- Advisor references must point to a person with an active advisor, faculty, professor, dean, or academic administrator role.

### StaffProfile

Purpose: staff and instructional metadata for a person who works for or teaches at the institution.

Fields:

- `id`
- `tenantId`
- `personId`
- `staffNumber`
- `title`
- `primaryRole`
- `primarySubdivisionId`
- `employmentStatus`
- `loadPolicy`
- `createdAt`
- `updatedAt`

Primary role values:

- `teacher`
- `professor`
- `faculty`
- `advisor`
- `registrar`
- `admissions`
- `academic_admin`
- `dean`
- `institution_admin`

Rules:

- Staff profiles must reference a person in the same tenant.
- Teacher and professor section assignment requires an active instructional role assignment.
- A person can have both staff and student profiles, but future UI must label context clearly.
- Staff profile status does not by itself grant permissions; role assignments grant permissions.

### StudentRelationship

Purpose: connect students to guardians, advisors, emergency contacts, mentors, or other relevant people.

Fields:

- `id`
- `tenantId`
- `studentPersonId`
- `relatedPersonId`
- `relationshipType`
- `authority`
- `visibility`
- `status`
- `startsOn`
- `endsOn`
- `createdAt`
- `updatedAt`

Relationship types:

- `guardian`
- `parent`
- `emergency_contact`
- `pickup_contact`
- `advisor`
- `mentor`
- `field_supervisor`
- `sponsor`
- `custom`

Authority values:

- `view_only`
- `academic_decision`
- `registration_decision`
- `emergency_contact`
- `pickup_authorized`
- `none`

Visibility values:

- `directory_only`
- `schedule`
- `documents`
- `progress`
- `grades`
- `billing_excluded`
- `full_guardian`

Rules:

- Student and related person must belong to the same tenant.
- Guardian portal visibility is granted by active relationship plus allowed visibility, not by the guardian role alone.
- Children's school guardians must have an active relationship to the child student.
- A guardian relationship may have limited visibility for custody, legal, or institutional policy reasons.
- Advisor and mentor relationships do not imply guardian rights.
- Inactive or expired relationships must not expose student PWA data.

### AccountLink

Purpose: future link between a person and an authentication or provider identity.

Fields:

- `id`
- `tenantId`
- `personId`
- `provider`
- `externalSubject`
- `status`
- `createdAt`
- `updatedAt`

Provider values:

- `supabase_auth`
- `moodle`
- `canvas`
- `external`

Rules:

- Account links are identifiers only.
- Account links must not store access tokens, refresh tokens, passwords, provider secrets, webhook payloads, or LMS activity data.
- Provider-specific token storage belongs in the future LMS integration contract and adapter layer.

## Permission Model

People permissions will be capability-based, not only role-name based. Roles grant default capabilities; future route policies should check capabilities and tenant/scope match.

Core capabilities:

- `people.read`
- `people.write`
- `people.admin`
- `roles.read`
- `roles.assign`
- `student.read.self`
- `student.read.assigned`
- `student.read.guardian`
- `student.write.admin`
- `staff.read`
- `staff.assign_instruction`
- `guardian.relationship.read`
- `guardian.relationship.write`

Default role posture:

- `institution_admin`: full tenant people and role administration.
- `dean`: read people, read staff, assign instructional/advising context within academic scope.
- `registrar`: read/write student academic people records and guardian relationships where needed for records.
- `academic_admin`: read people and staff, coordinate sections and instructional assignments.
- `admissions`: read/write applicant and guardian intake data, no grade/transcript authority by default.
- `advisor`: read assigned students.
- `faculty`, `teacher`, `professor`: read assigned sections and assigned students only.
- `student`: read own PWA-visible records.
- `guardian`: read related student records only according to active relationship visibility.

## Validation Rules

Future implementation should reject:

- role assignments whose person belongs to another tenant
- student profiles without a matching student role assignment
- guardian role assignments that are treated as tenant-wide student access
- children's school child students without guardian review when guardians are required
- teacher/professor course-section assignment without an active instructional role
- advisor references without an active advisor-capable role
- active relationships whose student or related person is archived
- account links that store secrets or provider tokens
- cross-tenant relationships, profiles, or account links

## Student PWA And Guardian Boundary

The student PWA must read from student-scoped read models, not raw people tables.

Student access:

- A student can see their own schedule, courses, documents, messages, academic progress, grades when released, and LMS launch links when available.
- A student cannot see other students, guardian records, staff records, or institutional role assignments.

Guardian access:

- A guardian can see only students with an active guardian relationship.
- Visibility is relationship-scoped and may vary by student.
- Guardian access for children's school mode must support schedule, documents, progress, and school communications.
- Grade/transcript visibility must respect release rules from the future grading/transcript domain.
- Guardians must not receive staff-only notes, counseling records, spiritual-condition data, giving data, or LMS engagement analytics through Academy.

## LMS Boundary

The people domain owns Academy identity and role references. The LMS integration domain owns provider identity mapping, launch, roster sync, enrollment sync, grade return, progress return, retries, reconciliation, provider errors, and credentials.

People records may later expose stable references to the LMS contract:

- person id
- student profile id
- staff profile id
- role assignment id
- account link id

People records must not contain:

- Moodle tokens
- Canvas tokens
- LMS passwords
- OAuth refresh tokens
- provider webhooks
- sync queue payloads
- LMS activity or engagement metrics

## ShepherdAI Boundary

Allowed future Academy-owned signals:

- student missing required guardian relationship
- student missing advisor assignment
- section missing instructor assignment
- instructor overload according to Academy load policy
- staff role conflict requiring administrator review
- expired guardian relationship still referenced by student PWA setup

Forbidden signals:

- LMS engagement analytics
- devotional behavior
- spiritual condition
- counseling notes
- giving or donations
- pastoral care records
- private guardian custody details beyond explicit access flags

## Security And Privacy Review

Future implementation must include:

- tenant-scoped persistence
- capability and relationship-scoped access checks
- audit trail for role and guardian relationship changes
- no platform support bypass without a separate ADR
- no provider tokens on people records
- no guardian access without active student relationship
- tests for cross-tenant denial, expired role denial, expired relationship denial, and student/guardian visibility limits

## Future Implementation Sequence

1. Phase 4 Sprint 2: people, role assignment, student profile, staff profile, relationship, and account-link types with validation tests.
2. Phase 4 Sprint 3: guardian relationship model details and privacy tests.
3. Phase 4 Sprint 4: role-scoped API access patterns.
4. Phase 4 Sprint 5: people and role admin review UI.
5. Course section instructor assignment workflow after people/roles read paths are stable.

## Review Checklist

- The design supports Bible schools, children's schools, seminaries, colleges, universities, and mixed institutions.
- Person identity is separate from login account identity.
- Guardian access is relationship-scoped, not tenant-wide.
- Teacher and professor assignment depends on active instructional roles.
- Student PWA access is scoped to self or active guardian relationship.
- LMS identity mapping is provider-neutral and excludes secrets.
- ShepherdAI signals are Academy-owned and exclude forbidden sources.
- Future implementation has deterministic validation rules.
