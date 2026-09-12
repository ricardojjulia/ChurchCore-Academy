# Shared OneRoster Standard Implementation Plan

Date: 2026-09-12
Council: `docs/reviews/2026-09-12-council-review-16-shared-oneroster-standard.md`
Status: In progress

## Factory Intake

Feature: Professional-grade shared OneRoster implementation for ChurchCore Academy and ChurchCore LMS.

Product area: LMS contract, SIS-to-LMS roster exchange, gradebook return, integration governance.

Primary users:

- Academy registrars and administrators
- LMS administrators and teachers
- implementation consultants
- future adapter developers
- students whose access, grades, and progress depend on reliable sync

Institution modes affected:

- children's school
- K-12 Christian school
- Bible school
- seminary
- college
- university
- mixed institution

Data touched:

- organizations
- people
- roles
- academic years and periods
- course catalog
- sections
- section enrollments
- gradebook records
- progress records
- transcript candidates
- integration jobs and audit logs

## Current State

Academy already has a provider-neutral `lms-contract` module, but its concrete execution history is Moodle/Canvas shaped. LMS already has OneRoster CSV consumer work for `manifest`, `orgs`, `users`, `roles`, `academicSessions`, `courses`, `classes`, and `enrollments`, including validation, staging, preview, apply, provenance guards, bulk omission reconciliation for academic records, and identity linking.

The gap is not conceptual fit. The gap is shared standard ownership:

- Academy needs a first-class OneRoster Provider implementation.
- LMS needs parser/profile hardening against OneRoster CSV 1.2.1.
- Both repos need fixture parity so Academy export and LMS import cannot drift.
- Gradebook/result return needs to move from provider-shaped imports to OneRoster-shaped reviewed imports.

## Architecture

Use a four-layer implementation:

1. Shared standard profile
   - canonical file vocabulary
   - supported service matrix
   - required privacy and idempotency rules
   - profile IDs for Academy provider and LMS consumer

2. Academy Provider
   - extract real SIS data into OneRoster domain objects
   - serialize deterministic CSV packages
   - expose manual export first
   - add signed scheduled export/pull after manual parity passes

3. LMS Consumer
   - validate against shared profile
   - stage rows
   - preview counts and quarantine reasons
   - apply idempotently with provenance
   - preserve standalone/local enrichment paths

4. Gradebook Return
   - LMS emits OneRoster gradebook data
   - Academy accepts reviewed imports
   - official records update only after Academy review/approval

## Milestones

### M0 - Governance And Shared Profile

Deliverables:

- Accepted council record.
- Cross-repo implementation plan.
- Typed OneRoster profile constants in Academy.
- Tests proving the target file vocabulary, service lanes, and privacy rules.

Verification:

- `npm test -- src/modules/oneroster-standard/__tests__/profile.test.ts`
- `npm run lint`

### M1 - LMS Profile Hardening

Deliverables:

- LMS parser recognizes the complete official OneRoster CSV 1.2.1 file vocabulary.
- Unsupported-but-known files produce profile-aware messages, not generic unknown-file failures.
- `users.csv` header support is updated for OneRoster 1.2 names such as `agentSourcedIds`, `primaryOrgSourcedId`, preferred names, `userMasterIdentifier`, and `pronouns`.
- Manifest validation distinguishes official vocabulary from ChurchCore-supported profile.

Verification:

- LMS OneRoster unit tests.
- fixture tests for known unsupported files.
- no raw PII in errors.

### M2 - Academy Rostering Export

Deliverables:

- `src/modules/oneroster-standard` grows pure domain types and CSV serialization.
- Academy maps SIS data to `orgs`, `users`, `roles`, `academicSessions`, `courses`, `classes`, and `enrollments`.
- Export service uses real repositories, not mock data.
- Manual admin export endpoint is tenant-scoped and audit logged.

Verification:

- node tests create full dependency data through module functions.
- generated ZIP validates with LMS importer.
- no provider secrets or raw PII in logs.

### M3 - Cross-Repo Fixture Parity

Deliverables:

- deterministic Academy fixture package.
- LMS parity test command that validates the fixture.
- shared fixture version and changelog.

Verification:

- Academy export test writes a package to a temp artifact.
- LMS validation test consumes that package.
- hash-stable package generation.

### M4 - Scheduled Exchange

Deliverables:

- tenant-scoped connection settings.
- signed Academy export job or LMS pull job.
- replay-safe idempotency keys.
- retry and quarantine handling.
- operator history UI.

Verification:

- scheduled job dry-run.
- replay test.
- cross-tenant rejection.
- failure and retry tests.

### M5 - Gradebook Return

Deliverables:

- LMS maps grades/progress to OneRoster gradebook lineItems/results.
- Academy reviewed-import workflow accepts result batches.
- Academy does not mutate official transcript records until review.
- reconciliation identifies missing, stale, duplicate, and changed results.

Verification:

- reviewed import tests.
- official-record non-mutation tests.
- idempotent reimport.
- student/guardian visibility checks.

### M6 - REST And Certification Readiness

Deliverables:

- REST endpoints for supported rostering operations.
- OAuth/client credential boundary if required.
- conformance checklist mapped to 1EdTech profiles.
- product claim wording reviewed.

Verification:

- API contract tests.
- conformance fixture suite.
- security review.

## Definition Of Done

The shared implementation is complete when:

- Academy can export a valid OneRoster rostering package from real tenant data.
- LMS can import, preview, link, apply, reconcile, and audit that package.
- The same package can be replayed safely.
- Supported bulk omissions deactivate only supported records.
- Supported delta packages never infer deletion from absence.
- LMS can return grade/progress data in OneRoster gradebook form.
- Academy ingests returned results through reviewed import workflow.
- Both systems pass unit, lint, build, and targeted integration checks.
- Browser workflows exist for operator preview/history/review paths.
- Claims distinguish internal profile support from formal 1EdTech certification.

## First Execution Slice

Completed on 2026-09-12:

- Created the council record and cross-repo implementation plan.
- Added the typed OneRoster profile module in `src/modules/oneroster-standard`.
- Added the pure Academy OneRoster CSV package contract in `src/modules/oneroster-contract`.
- Verified export shape, manifest semantics, reference integrity, secret exclusion, official file vocabulary, service lanes, and privacy/idempotency rules.

## Second Execution Slice

Completed on 2026-09-12:

- Added repository-backed Academy OneRoster dataset/package generation from people, course catalog, academic calendar, and section-registration repositories.
- Added a tenant-level `/api/academy/lms/oneroster-package` export route using the existing session and capability context.
- Kept the route delta-only for the current ChurchCore profile.
- Verified cross-tenant export rejection before repositories run.
- Verified that administrator roles and account-link secrets are not emitted.
- Updated the LMS Academy-contract fixture to match the new stable `academy:*` `sourcedId` shape.

## Third Execution Slice

Completed on 2026-09-12:

- Added `npm run oneroster:fixture` to generate `fixtures/oneroster/churchcore-academy-rostering-v1`.
- Generated the fixture through the repository-backed Academy export service boundary.
- Added metadata and per-file hashes so package drift is detectable.
- Added Academy test coverage proving the checked-in fixture is generated from the live exporter.
- Added LMS cross-repo validation of the exact generated fixture, including package hash, file hashes, safe profile validation, withdrawn enrollment deactivation, secret exclusion, and ZIP packaging/readback.

Next slice: LMS apply/replay verification from the generated artifact, followed by the admin preview/download workflow.
