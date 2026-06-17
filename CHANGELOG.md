# Changelog

All notable changes to ChurchCore Academy are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning for development milestones.

## [Unreleased]

### Added

- Professional repository documentation and community health files.
- MIT license and explicit package metadata.
- Technology, project-status, contribution, security, support, and conduct documentation.
- GitHub issue forms and pull request template.
- GitHub Actions quality gate and Dependabot configuration.
- Safe `.env.example` for local configuration.

### Changed

- Reworked the README to distinguish implemented foundations, working vertical slices, and planned capabilities.

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

### Added

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

[Unreleased]: https://github.com/ricardojjulia/ChurchCore-Academy/compare/9c41beb...HEAD
[0.1.0]: https://github.com/ricardojjulia/ChurchCore-Academy/tree/9c41beb
