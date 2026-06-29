# Changelog

All notable changes to ChurchCore Academy are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning for development milestones.

## [Unreleased]

### Added

- Council Review XIII MVP and competitive stance evaluation at `docs/reviews/2026-06-26-council-review-13-mvp-competitive-stance.md`, including council-role findings, wildcard adversarial review, updated scorecard, competitor stance, and recommended next factory moves.

### Changed

- Updated `docs/project-status.md` to reference Council Review XIII and clarify that controlled-pilot/design-partner positioning is approved while production/GA parity claims remain deferred.

## [0.8.0] - 2026-06-26

### Added (Controlled-pilot and full LMS closeout)

- Council Review XII full Moodle and Canvas integration MVP closeout at `docs/reviews/2026-06-26-council-review-12-full-lms-integration-mvp.md`.
- Full LMS integration readiness package at `docs/releases/2026-06-26-full-lms-integration-readiness.md`.
- Moodle and Canvas provider activation boundary, including tenant-scoped non-secret provider configuration, secret-reference storage, validation evidence, and cross-tenant rejection tests.
- Live Moodle Web Services HTTP client behavior, including REST request construction, exception-in-200 handling, retry/permanent failure classification, and provider-secret redaction.
- Live Canvas REST/OAuth client behavior, including bearer-token request handling, token refresh boundary coverage, and safe provider output.
- Canvas SIS import guardrails, including explicit safety treatment for destructive batch-mode behavior.
- Durable LMS operation job queue with tenant/provider/operation-family/idempotency-key replay suppression.
- LMS worker handling for retryable failures, retry exhaustion, circuit-open blocking, circuit reset after success, admin notifications, audit events, and operational-event emission.
- Student PWA Moodle and Canvas launch parity with safe launch responses and scoped guardian support.
- Moodle and Canvas reviewed grade/progress return boundaries that create reviewed imports rather than official-record auto-posts.
- Moodle and Canvas reconciliation parity for course shells, sections, instructors, students, launch mappings, grade return mappings, progress return mappings, provider capabilities, and credential health.
- LMS readiness surface at `/admin/settings/lms` showing provider status, validation posture, circuit state, sync/failure status, sandbox evidence, pause state, and resume state.
- LMS readiness API at `/api/academy/lms/readiness` with role-gated read/manage behavior.
- LMS execution worker runbook at `docs/runbooks/lms-execution-workers.md`.
- Updated provider activation runbook coverage for Moodle and Canvas live HTTP activation and rollback.
- Authenticated role walkthrough harness, seeded acceptance personas, and acceptance evidence template for pilot onboarding.
- Production observability foundation for authentication, authorization, workflow, migration, and LMS provider-worker failures.
- Controlled-pilot release closeout documentation that separates code-complete implementation from live environment activation gates.
- Root `HOWTO.md` with local setup, safe reset, verification, migration, provider activation, role walkthrough, data-safety, troubleshooting, and release checklist guidance.
- Root `VERSIONING.md` with pre-GA semantic versioning rules, release classes, status language, changelog rules, tag guidance, and verification gates.

### Changed

- Bumped package metadata from `0.7.1` to `0.8.0`.
- Rewrote `README.md` around the current controlled-pilot candidate posture, `0.8.0` version, port `3200`, product boundaries, architecture rules, route surface, audit gates, and latest LMS implementation closeout.
- Rewrote `docs/project-status.md` to reflect the current `0.8.0` state, implemented capabilities, external release gates, product safety position, and canonical references.
- Expanded `docs/README.md` with links to HOWTO, CHANGELOG, VERSIONING, release notes, and the newer operations runbooks.
- Reclassified Moodle/Canvas sandbox proof, deployment observability, pilot browser walkthroughs, and regulated/federal aid as external release/governance gates rather than open repository implementation tasks.
- Updated `docs/product/factory-roadmap.md` and Council Review IX addendum language to distinguish closed implementation from external evidence gates.
- Clarified that code-complete Moodle/Canvas integration does not equal production provider activation.

### Fixed

- Corrected README local URL from `http://localhost:3000` to `http://localhost:3200`, matching the package scripts.
- Corrected stale project status version from `0.1.0` to `0.8.0`.
- Removed local macOS `.DS_Store` metadata files from the repository working tree.

### Security

- Documented that provider secrets, payment secrets, webhook signatures, raw provider payloads, service-role keys, and real student/financial/aid/counseling records must not be committed or exposed in browser payloads.
- Documented that provider secrets must stay out of Student PWA models, guardian models, audit metadata, official records, ShepherdAI inputs, LLIS payloads, reporting exports, logs, and ordinary Academy domain tables.
- Preserved the release rule that model-generated learner predictions and autonomous academic/pastoral interventions require separate governance approval.

### External Gates

- Moodle production activation still requires sandbox or tenant test-instance evidence for credential validation, course shell sync, roster sync, Student PWA launch, reviewed grade/progress return, reconciliation, rollback, and secret redaction.
- Canvas production activation still requires sandbox or tenant test-instance evidence for OAuth/token refresh, course shell sync, roster sync, Student PWA launch, reviewed grade/progress return, SIS import guardrails, reconciliation, rollback, and secret redaction.
- Live payment checkout, live email/SMS delivery, regulated/federal aid, deployment-specific observability wiring, and per-tenant browser walkthrough evidence remain external activation or pilot-expansion gates.

### Added (Repository documentation and GitHub hygiene)

- Professional repository documentation and community health files.
- AGPL-3.0 open-source license and explicit package metadata.
- Technology, project-status, contribution, security, support, and conduct documentation.
- GitHub issue forms and pull request template.
- GitHub Actions quality gate and Dependabot configuration.
- Safe `.env.example` for local configuration.

### Changed (Repository documentation baseline)

- Reworked the README to distinguish implemented foundations, working vertical slices, and planned capabilities.

## [0.7.1] - 2026-06-17

### Changed (Single-tenant cleanup — v0.7.1)

- `supabase/migrations/20260617030000_remove_dead_tenant.sql` — removes the auto-created `cca-ui-btn-119445` tenant ("UI Button 119445") that was generated when the platform control panel was first opened in local development. Deletes its institution profile, account link, person, role assignments, subdivision, and calendar profile. Resets platform user preferences to `cca-main`. The local database now has exactly one tenant.

## [0.7.0] - 2026-06-17

### Added (Tenant Identity Fix — v0.7.0)

- `supabase/migrations/20260617010000_link_developer_to_cca_main.sql` — links the developer account (`ricardojjulia@gmail.com`) to `person-regina-holt` in `cca-main` as `institution_admin` and `platform_admin`, and sets `cca-main` as the preferred active tenant. Fixes the root cause of the dashboard showing "UI Button 119445" and zero Students/Programs/Faculty counts.
- `supabase/migrations/20260616225000_fix_academic_programs_subdivision_id_type.sql` — corrects `academy_academic_programs.subdivision_id` from `uuid` to `text` to match `academy_institution_subdivisions.id` (text PK). Unblocks the enrollment seed.
- `supabase/migrations/20260616226000_fix_academic_programs_creator_id_type.sql` — corrects `academy_academic_programs.created_by_person_id` from `uuid` to `text` to match `academy_people.id` (text PK). Unblocks the enrollment seed.
- `supabase/migrations/20260616230000_seed_demo_enrollment_data.sql` — now applies successfully: seeds 4 normalized programs, runs full admission state machine (draft → submitted → under_review → accepted) for Naomi Price, Daniel Hart, Leah Brooks, and Ezra Coleman, and creates program enrollments, period registrations, course section registrations, and sample gradebook submissions.

### Changed (Migration Runner — v0.7.0)

- `scripts/db-migrate-local.ts` — added idempotent migration tracking via `public.schema_migrations` table. The runner now skips migrations that were previously applied, preventing `CREATE POLICY` failures on re-runs. Also bootstraps the tracking table from DB object markers when run against an already-migrated database that predates the tracker.

## [0.6.0] - 2026-06-17

### Added (Dashboard Navigation — v0.6.0)

- Admin dashboard "Start Here" quick actions now include **Course Catalog** (`/admin/courses`) and **Graduation** (`/admin/graduation`), making all new screens reachable from the dashboard without needing to expand sidebar sections.
- Quick actions panel is now shown even when dataset is not seeded (empty-state path), so the nav remains usable before migrations run.

### Security (v0.6.0)

- Admin dashboard (`/admin`) now uses `loadProtectedAcademyDataset()` to derive tenant ID and pre-load the dataset instead of reading the `x-academy-tenant-id` request header. Consistent with the Prompt 15 fix on the workflows page.

## [0.5.0] - 2026-06-17

### Added (Graduation + ShepherdAI — Prompts 14–15)

- `src/app/admin/graduation/page.tsx` — new `/admin/graduation` screen (nav link existed, page was missing). Shows graduation audit with four metric cards (active students, review-ready count, hold count, credit threshold), three candidate tables (ready for registrar review / holds pending / in progress), and per-student credit progress, GPA, holds, and links to student profiles.
- `src/app/admin/graduation/page.tsx` uses `dataset.thresholds.graduationCreditThreshold` to compute per-student readiness without any hardcoded values.

### Security (Prompts 14–15)

- `src/app/admin/workflows/page.tsx` — replaced insecure header-derived `x-academy-tenant-id` tenant resolution with `loadProtectedAcademyDataset()`. ShepherdAI evaluation now runs against the verified actor's tenant ID and the pre-loaded real dataset. Removes the `headers()` import.

## [0.4.0] - 2026-06-16

### Added (Screen Wiring — Prompts 4–10)

- `src/app/admin/courses/page.tsx` — new `/admin/courses` screen (nav link existed, page was missing). Shows course catalog metrics, course table with type/level/duration/subdivision/status, and section table with period name resolution, instructor name lookup from `dataset.peopleConfiguration.people`, and live roster counts.
- `src/app/faculty/attendance/faculty-attendance-form.tsx` — extracted client form component for faculty attendance entry; accepts server-provided sections and students instead of hardcoded demo data.

### Updated (Screen Wiring — Prompts 4–10)

- `src/modules/academy-data/postgres-repository.ts` — `adminsResult` query now uses `p.id` (person ID) as `admin.id` so that `student.advisorUserId` (which is `advisor_person_id`) resolves correctly in the student detail page advisor lookup.
- `src/app/admin/attendance/page.tsx` — replaced hardcoded `demo-section-1` API link with a real list of sections from `dataset.sections`, each linking to the attendance API with its real section ID.
- `src/app/faculty/attendance/page.tsx` — converted from a pure client component with hardcoded demo data to a server component that loads real sections and students from `loadProtectedAcademyDataset()`, then delegates rendering to `FacultyAttendanceForm`.
- All admin screens (`/admin/students`, `/admin/students/[id]`, `/admin/programs`, `/admin/programs/[id]`, `/admin/settings/courses`, `/admin/sections`, `/faculty`, `/dashboard/admin/gradebook`) are fully unblocked by the Prompt 3 repository rewrite — no additional page changes were required for Prompts 5–9.

## [0.3.0] - 2026-06-16

### Changed (Real DB Wiring — Prompt 3)

- `AcademyDataRepository.loadDataset()` rewritten to query real normalized tables instead of empty stub tables. The `academy_thresholds`, `academy_students`, `academy_faculty`, `academy_sections`, and `academy_admin_users` queries have been replaced.
- Students are now derived from `academy_student_profiles JOIN academy_people` with subquery-computed `application_started_at`, `admitted_at`, and `active_term` from the real admission and registration tables.
- Faculty are now derived from `academy_staff_profiles JOIN academy_people` with computed `assigned_section_ids` (from `academy_course_sections.primary_instructor_id`) and `advisee_count` (from `academy_student_profiles.advisor_person_id`).
- Course sections are now derived from `academy_course_sections JOIN academy_courses` with live roster counts from `academy_course_section_registrations`.
- Administrators are now derived from `academy_person_role_assignments JOIN academy_people LEFT JOIN academy_staff_profiles` filtered to admin-class roles.
- `dataset.thresholds` now uses hardcoded operational defaults rather than requiring a seeded `academy_thresholds` row; the guard that threw "Academy dataset is not seeded." is removed.
- All 25 normalized foundation queries now run in parallel via `Promise.all` for faster dataset assembly.
- `seedFromMockData()` method preserved unchanged for test use.

## [0.2.0] - 2026-06-16

### Added (SIS Data Foundation — Prompts 1–2)

- `academy_academic_programs` — normalized UUID-PK programs table replacing the stub `academy_programs` for future enrollment flows. Supports all six institution modes (bible_school, childrens_school, seminary, college, university, mixed) and eight credential types. RLS enforced with `enable` + `force`.
- `PostgresAcademicProgramRepository` with `list`, `findById`, `findByCode`, `create`, and `update`. All tenant-scoped.
- `validateCreateProgramInput` — normalizes `programCode` to uppercase, rejects invalid modes and credential types.
- `GET /api/academy/programs` and `POST /api/academy/programs` — list and create programs via verified Academy actor.
- `GET /api/academy/programs/[id]` and `PATCH /api/academy/programs/[id]` — read and update individual programs.
- 8 unit tests covering success path, validation, and cross-tenant rejection.
- `20260616085000_seed_demo_institution_foundation.sql` — populates all real normalized tables: institution profile, calendar, subdivisions (7), academic years (4), academic periods (5 across Bible School, Children's, and College calendars), course catalog profile, grading profile, 7 courses, 12 people (students, faculty, staff, guardian), person role assignments, 6 student profiles (including pending and admitted states), 5 staff profiles, student relationships, 6 course sections, old and new evaluation scales with letter-grade bands, gradebook scales + entries, and gradebook assignments. IDs match `mock-data.ts` for smooth Prompt-3 DB query migration.
- `20260616230000_seed_demo_enrollment_data.sql` — seeds 4 normalized programs in `academy_academic_programs`, runs the full admission state machine (draft → submitted → under_review → accepted) for Naomi Price, Daniel Hart, Leah Brooks, and Ezra Coleman, creates program enrollments, period registrations, and course section registrations for active students, and inserts sample gradebook submissions and graded records.

## [0.1.0] - 2026-06-14

### Added (Foundation — v0.1.0)

- Multi-tenant institution configuration, academic calendar, course catalog, people, guardian, faculty, grading, and transcript-rule foundations.
- Verified Supabase session identity, persisted Academy account links and roles, request-scoped PostgreSQL context, forced RLS, and immutable audit events.
- Tenant-isolated admissions application, submission, review, decision, and accepted-application enrollment conversion workflows.
- Student PWA shell, installability, safe offline fallback, and provider-neutral LMS launch orchestration.
- Provider-neutral LMS contract with no-LMS, Moodle, and Canvas adapter foundations.
- Deterministic ShepherdAI Academy workflow recommendations and review lifecycle.
- Governed Living Learner Intelligence System foundation with learner-owned consent, immutable consent evidence, and live RLS verification.
- Demo feedback capture and protected platform triage workflow.
- Repository-owned software factory, design specifications, implementation plans, ADRs, runbooks, and review procedures.

### Security

- Removed production trust in caller-supplied Academy identity headers.
- Added tenant-aware composite foreign keys and database role-matrix verification.
- Added append-only audit and learner-intelligence evidence storage.

[Unreleased]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/ricardojjulia/ChurchCore-Academy/releases/tag/v0.8.0
[0.7.1]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ricardojjulia/ChurchCore-Academy/tree/9c41beb
