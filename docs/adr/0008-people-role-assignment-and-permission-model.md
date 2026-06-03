# ADR 0008: People Role Assignment And Permission Model

Date: 2026-06-02
Status: accepted

## Context

ChurchCore Academy must support students, guardians, teachers, professors, faculty, advisors, registrar staff, admissions staff, academic administrators, deans, and institution administrators across Bible schools, children's schools, seminaries, colleges, universities, and mixed institutions.

The current repository has a bootstrap role list for institution configuration reads, but future course assignment, student PWA access, guardian visibility, grading, transcripts, LMS roster sync, and ShepherdAI setup recommendations need a broader role model.

If roles live only on login accounts or directly on route checks, future permissions will drift and will not handle people with multiple roles, children without login accounts, staff who are also students, or subdivision-scoped responsibilities.

## Decision

ChurchCore Academy will separate person identity from role assignment.

The people domain will use:

- `Person` for tenant-scoped human identity
- `PersonRoleAssignment` for active roles and scopes
- `StudentProfile` for student-specific academic identity
- `StaffProfile` for staff and instructional metadata
- `StudentRelationship` for guardian, advisor, mentor, and other person-to-student relationships
- future `AccountLink` records for authentication and provider identity references

Authorization will move toward capability checks derived from active role assignments and scope, not raw role-name checks alone.

Role assignments may be tenant-scoped, subdivision-scoped, course-section-scoped, or student-scoped depending on role and future workflow.

## Consequences

This supports:

- one person with multiple roles
- children without login accounts
- staff who are also students
- teacher and professor assignment readiness
- advisor and guardian boundaries
- future LMS identity mapping without making LMS identity the source of truth
- deterministic, testable authorization rules

The tradeoff is that future implementation requires validation and UI clarity around person, profile, role assignment, and relationship records.

## Alternatives Considered

Account-centric users:

- rejected because it couples Academy identity to authentication accounts and does not fit children, guardians, inactive people, or provider-neutral LMS identity mapping

Separate student, faculty, and administrator tables only:

- rejected because it duplicates person data and makes multi-role people difficult to audit

Person core plus scoped role assignments:

- accepted because it preserves a durable SIS identity while supporting explicit permissions and relationships

## Review Notes

- Product boundary: Academy owns people, role assignment, student/staff profile, and relationship records as SIS system-of-record data.
- LMS boundary: LMS provider identity mapping may reference people later, but provider credentials, tokens, sync payloads, and runtime behavior stay in the LMS integration layer.
- Security/privacy: future writes must be tenant-scoped, audited, and denied when role assignments are expired, cross-tenant, or outside scope.
- Testing: implementation must test active and expired roles, cross-tenant denial, scoped staff access, student self-access, and denied tenant-wide guardian access.
- Rollback: this sprint changes docs only; future schema work must be reversible through migrations.
