# ChurchCore Academy Architecture Boundary

## Repositories

### ChurchCore Academy repository

Owns:

- faith-based SIS and education-management workflows
- Bible school, children's school, seminary, college, and university configuration
- students, guardians, faculty, teachers, professors, administrators, academic records, and permissions
- academic years, terms, sessions, cohorts, campuses, departments, divisions, calendars, course catalogs, sections, grading models, transcripts, and student PWA workflows
- admissions, enrollment, transcript, grading, graduation, and compliance operations
- dashboards, reporting, and academic-administrative workflows
- LMS launch orchestration from the Academy side

Does not own:

- Moodle runtime
- Moodle themes or plugins
- Canvas runtime internals
- LMS course delivery behavior

### LMS provider repositories or services

Owns:

- Moodle or Canvas runtime maintenance
- LMS themes, plugins, extensions, or provider-specific deployment assets
- LMS course delivery experience
- course delivery and learning runtime concerns
- Academy-driven launch and sync endpoints exposed inside the provider

## Integration contract

Keep the cross-system boundary narrow and explicit:

- identity handoff
- tenant and campus context
- enrollment sync
- roster sync
- grade/progress return path
- logout coordination
- audit logging across systems
- provider capability reporting
- reconciliation jobs and idempotent retries

## Architectural rule

If a feature still makes sense when Moodle is removed, it belongs in the ChurchCore Academy repository.

If a feature only exists because Moodle or Canvas behaves a certain way, it belongs in an LMS provider adapter or provider repository, not in Academy domain logic.

## Production security boundary

- Supabase `auth.getUser()` verifies the external session.
- Active `academy_account_links` and role assignments resolve Academy person, tenant, and authority.
- Request headers never grant production identity or roles.
- Every Academy-owned table enables and forces RLS through the Release 1 and domain migrations.
- Protected server pages execute dataset reads inside `withAcademyDatabaseContext`.
- Seeded Academy records are prohibited from runtime UI modules.
- Audit records are append-only and reject secret-shaped metadata.

Request-facing reads and workflow mutations share verified request-scoped RLS transactions. Until live policy and browser-role verification are complete, Release 1 is implemented but not production-approved.

## Admissions boundary

- Admission applications are pre-student records, not student profiles or enrollments.
- Applicant, program, term, deciding staff, and event references are constrained by tenant-aware composite foreign keys.
- Applicants require an active `applicant` role and may access only their own application.
- Authorized same-tenant staff may review and decide applications.
- Every mutation is idempotent and writes immutable application and global audit events.
- Acceptance has no automatic SIS or LMS side effects.
- An authorized conversion request creates the student role, student profile, program enrollment, and academic-period registration in one request-owned transaction.
- Conversion retains the applicant role and leaves the application in the accepted state with immutable references to the created records.
- Student numbers are allocated per tenant under a row lock; idempotency and unique application constraints prevent duplicate conversion.
- Course-section registration, billing, financial aid, LMS provisioning, and Student PWA record release remain downstream workflows.
