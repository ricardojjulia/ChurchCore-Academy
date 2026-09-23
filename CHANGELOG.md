# Changelog

All notable changes to ChurchCore Academy are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning for development milestones.

## [Unreleased]

### Added

- Ministry Formation admin UI (`/admin/formation`, `/admin/formation/[studentId]`), student formation dashboard (`/student/formation`), and a display-only formation-completion badge on the graduation-readiness page, surfacing the previously backend-only `ministry-formation` module (practicum sessions, faith milestones, evaluations, endorsement) with navigation entries (PR #105). Adds one-to-one formation-advisor assignment. First item in the "Surface the Built Differentiators" competitive closure plan.
- Full ADR-0045 role-scoped access for ministry formation records (`docs/adr/0071-ministry-formation-reviewer-role-and-capability-gating.md`): a new `ministry_formation_reviewer` role (grant/revoke UI on the staff detail page, institution_admin-only), pastoral notes restricted to institution_admin, the reviewer role, or the record's own evaluator, faculty scoped to their own course sections, formation-advisors scoped to their own advisees, and registrar capped to released-only records with no pastoral-notes access ever — this closes a gap where every formation-viewer role previously had identical tenant-wide access including pastoral notes.
- A new `ministryFormation` institution capability (on for bible_school/seminary/college/university, off for childrens_school), enforced on every ministry-formation route and page, with `CapabilityGhostPage` shown when disabled and Student PWA/admin nav entries hidden accordingly — the first real usage of capability-based nav-hiding in this codebase (ADR-0061).
- An append-only `ministry_formation_advisor_assignment_history` table recording every formation-advisor assignment, so reassignment no longer silently overwrites the prior advisor's record with no trace.

Working vertical slice — code-complete and test-verified through Council Review 16 and Council Review 17 (`docs/reviews/2026-09-14-council-review-16-ministry-formation-admin-ui.md`, `docs/reviews/2026-09-14-council-review-17-adr-0045-compliance-follow-up.md`), including verification of the access-scoping and migration fixes against a real local database, not yet browser click-tested or pilot-observed.

### Fixed

- **Security:** every page under `/admin/*` (41 pages) previously called `requireActor()` with no role argument — authentication only, no authorization — meaning any logged-in user, including a `student`, `guardian`, or `applicant`, could load any admin page and read institution configuration, student/staff/guardian records, billing, financial aid, gradebook, and attendance data. Mutations were already correctly protected at the API layer; this was a read-side information-disclosure gap across the entire admin section. Added a baseline staff-only gate in `src/app/admin/layout.tsx` plus per-page role refinement reusing existing `requireActor(actor, roles)` / `assertInstitutionConfigAccess` conventions. Working vertical slice — build/test/lint verified, not yet browser click-tested with a real unauthorized account.

## [0.10.0] - 2026-09-12

### Added

- Nocturne dark design system adopted app-wide, replacing the light SIS palette: retuned token layer (`src/styles/tokens.css`, `src/app/globals.css`, `tailwind.config.ts`), restyled shared UI primitives (`Button`, `Badge`, `Table`, `Tabs`), the sidebar's left accent inset mark on the active nav item, and reskinned the login page, root error boundary, and two admin pages that had inline hex styles.
- Feature Inventory Audit and MVP Evaluation at `docs/reviews/2026-09-12-feature-inventory-audit-and-mvp-evaluation.md` — the current authoritative, code-verified feature-completeness reference. Confirms the full Core Academic Loop (academic years/periods, course catalog, programs, program curriculum, course sections, student program membership, section enrollment, student progress, grade entry, transcript entries, student groups) is built end-to-end with real Postgres-backed logic, admin UI, and tests.
- Architecture diagrams (Mermaid) in `docs/architecture.md`: system/repository boundary, request security boundary (Supabase auth → RLS), Core Academic Loop entity graph, and the admissions-to-conversion flow.
- OneRoster decision history at `docs/integrations/oneroster-decision-history.md`, recording that OneRoster is the ratified Academy/LMS exchange standard, that an Academy-side implementation was briefly merged then reverted the same day because the work belongs in ChurchCore LMS, and where to recover it from git history if needed.
- Idempotent enrollment conversion: `PostgresEnrollmentConversionRepository.convert()` now reuses an existing student profile, program enrollment, or period registration when a conversion is retried after a partial failure, instead of throwing or inserting conflicting rows; a repeat request with a different idempotency key now returns the existing result instead of throwing `AcademyConflictError`.

### Changed

- Bumped package metadata from `0.9.0` to `0.10.0`.
- Upgraded ~30 npm dependencies to their latest compatible versions (React 19.3, Next.js 16.3.5, Supabase JS/SSR, Radix UI, Stripe 22.6.2, Zod, react-hook-form, etc.).
- **Migrated Tailwind CSS 3 → 4.** `postcss.config.mjs` now uses `@tailwindcss/postcss`; `globals.css` uses `@import "tailwindcss"` with a `@config` compatibility pointer to the existing `tailwind.config.ts`, preserving the full token/color/radius/shadow customization built for Nocturne without a config rewrite. Removed the unused `darkMode` config key (no toggle exists; the app is dark-only).
- Bumped `tsconfig.json` `target` from `ES2017` to `ES2020` (needed for `s`-flag regexes already in the test suite; a safe modernization given `engines.node >= 24`).
- `docs/product/product-context.md`: corrected the "Current Honest State" table, which had gone stale and wrongly claimed six Core Academic Loop modules "do not exist" (they shipped 2026-07-09); struck through the now-obsolete "What NOT to Build Yet" entries for Guardian portal, Student PWA, billing, attendance, reporting, and ShepherdAI, with pointers to the audit.
- `docs/project-status.md`: points to the 2026-09-12 audit as the authoritative reference; added the Core Academic Loop items and Nocturne redesign to "Implemented And Verified."
- `CLAUDE.md`: corrected the Stack section, which incorrectly said "Mantine 7" — this codebase has never had a Mantine dependency; it uses Tailwind CSS + Radix UI + the Nocturne design system.
- `README.md`: version bump, Tailwind CSS 4 badge, links to the feature audit and OneRoster decision history.

### Fixed

- `@react-pdf/renderer`'s transitive dependency chain (`@react-pdf/textkit` → `@react-pdf/hyphenate`) had drifted to a version with a broken package `exports` map (missing a `require` condition), breaking transcript/aid-letter PDF generation under a fresh install. Pinned `@react-pdf/render`, `@react-pdf/layout`, and `@react-pdf/textkit` via `package.json` `overrides` to the last known-good versions.
- `src/lib/stripe.ts`: pinned Stripe API version string was stale relative to the `stripe` SDK's expected literal type (`2026-05-27.dahlia` → `2026-08-26.dahlia`).
- 65 pre-existing TypeScript errors across 22 test files, surfaced (not caused) by the Next.js 16.3.5 typecheck change covering files it previously didn't fully check. Included real bugs: a missing `alumni_relations` academy role and a missing `platform_admin`-gated actor case, several stale test fixtures left behind by the institution-mode-pack and capability-enforcement work (missing `covenantRecords`/`supportedModes`/`periodType` fields, wrong enum literals), and a battery of mock-typing gaps in Node's `mock.fn()` usage. Fixed all of them at the source rather than suppressing with `@ts-ignore`.
- A runtime test regression introduced and caught during the above: `academic-calendar/__tests__/calendar-crud.test.ts`'s shared term fixture used `periodType: "semester"`, which the real `getActiveTerm()` query (filters on `period_type = 'term'`) never matches — corrected to `"term"`.
- `docs/product/product-context.md`'s "What NOT to Build Yet" list contradicted its own "Current Honest State" table (e.g. listing Guardian portal and Student PWA as not-yet-built while `docs/project-status.md` and the code showed them working); reconciled.

### External Gates

No change to release posture. Billing, financial aid, communications, and LMS provider activation remain built-but-externally-gated per `docs/project-status.md`; regulated/federal aid remains a separate compliance gate.

## [0.9.0] - 2026-06-30

### Added (Capability enforcement and institution settings)

- Council Review III capability enforcement audit and design at `docs/reviews/council-review-3-capability-enforcement.md`, including Product/SIS Domain, Domain Architect, Security/Privacy, and Wildcard (Ghost Mode) councilor findings.
- ADR 0061 institution capability enforcement at `docs/adr/0061-institution-capability-enforcement.md`, recording the `withCapabilityContext` pattern, Ghost Mode UX, and HTTP 451 for disabled capabilities.
- `withCapabilityContext(actor, handler)` in `src/lib/capability-context.ts` — wraps `withAcademyDatabaseContext`, fetches the institution capability set once per request, and injects it alongside the database client. All capability enforcement runs through this function.
- `assertCapability(capabilities, key)` and `CapabilityDisabledError` (HTTP 451) in `src/modules/academy-auth/policy.ts` — centralized capability gate that throws a structured 451 error when a capability flag is false.
- `handleApi` extended to catch `CapabilityDisabledError` and return `{ available: false, capability, reason }` with HTTP 451.
- `CapabilityGhostPage` React component for admin pages surfacing a graceful "not available for your institution" screen with a link back to Institution settings.
- Ghost Mode CSS classes (`.ops-ghost-page`, `.ops-ghost-icon`, `.ops-ghost-title`, `.ops-ghost-detail`, `.ops-ghost-link`) in `src/styles/admin.css`.
- Capability enforcement wired to 35+ API routes across `studentPwa`, `guardianPortal`, `admissionsWorkflows`, `transcriptWorkflows`, `lmsLaunch`, `lmsRosterSync`, `lmsGradeReturn`, and `shepherdAiRecommendations`.
- `assertStudentPortalAccess` extended to accept an optional `capabilities` parameter and check `studentPwa`.
- Institution settings page redesigned as four fully clickable metric tiles (`InstitutionModelMetric`, `InstitutionTile`, `LmsProviderTile`, `ValidationTile`), each opening a focused dialog. All content cards removed from the page surface.
- Institution tile displays `legalName` (the actual configured name) instead of the `institutionName` field.
- Legal name editable inline in the Institution dialog via PATCH to `/api/academy/config/institution`.
- `updateIdentity` repository method in `AcademyConfigRepository` supporting dynamic `institutionName` and `legalName` updates.
- Capability badges in the Validation tile now show "Off — enforced" to communicate runtime enforcement.
- Academic period hard delete with enrollment guard — `deletePeriod` in `src/modules/academic-calendar/mutations.ts` and `DELETE /api/academy/calendar/periods/[id]` route. Blocked when student enrollments reference the period via course sections.
- Delete action and confirmation dialog in `PeriodActions.tsx` on the calendar settings page.
- Council Review XIII MVP and competitive stance evaluation at `docs/reviews/2026-06-26-council-review-13-mvp-competitive-stance.md`.
- Capability enforcement design spec at `docs/superpowers/specs/2026-06-29-capability-enforcement-design.md`.
- Capability enforcement implementation plan at `docs/superpowers/plans/2026-06-29-capability-enforcement.md`.
- Capability enforcement AI prompts at `docs/prompts/2026-06-29-capability-enforcement-ai-prompts.md`.
- Release notes at `docs/releases/2026-06-30-capability-enforcement-release-notes.md`.

### Changed

- Bumped package metadata from `0.8.0` to `0.9.0`.
- Updated `docs/project-status.md` to reflect `0.9.0` state and capability enforcement in the Implemented list.
- Updated `README.md` version reference to `0.9.0`.
- Updated `VERSIONING.md` current version to `0.9.0`.
- Updated `docs/project-status.md` to reference Council Review XIII and clarify that controlled-pilot/design-partner positioning is approved while production/GA parity claims remain deferred.

### Security

- Institution capability flags now gate API route access at runtime. A tenant with `lmsLaunch: false` cannot reach LMS launch endpoints. A tenant with `graduationWorkflows: false` cannot reach graduation endpoints. Role checks remain unchanged; capabilities are a second additive gate.
- Capability enforcement is always tenant-scoped: the capability set is fetched within `withAcademyDatabaseContext` using the authenticated actor's `tenantId`.

### External Gates — Unchanged

- All external activation gates from 0.8.0 remain in effect.
- `facultyPortal`, `registrarWorkflows`, and `graduationWorkflows` capability gates are wired but have no routes to protect yet; they will activate automatically when those route groups are built.

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

[Unreleased]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/03b660e...HEAD
[0.10.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.9.0...03b660e
[0.9.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/ricardojjulia/ChurchCore-Academy/releases/tag/v0.8.0
[0.7.1]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ricardojjulia/ChurchCore-Academy/tree/9c41beb
