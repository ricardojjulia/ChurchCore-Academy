# Student PWA Design

## Factory Intake

Feature: Phase 6, Sprint 1 Student PWA design package.

Product area: Student Self-Service, Guardian-Visible Student Records, Mobile Installability, Offline-Friendly Student Workflows, and LMS Launch Boundary.

Primary users:

- students in Bible schools, seminaries, colleges, and universities
- children's school students where direct access is enabled
- guardians with active relationship-scoped visibility
- registrar, academic administrator, faculty, teacher, and advisor staff who need predictable student-facing release behavior
- implementation consultants
- future Codex, GitHub Copilot, Claude Code, and similar agents working in this repo

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched in this sprint: documentation only.

LMS provider impact: defines future LMS launch and status boundaries for no-LMS, Moodle, Canvas, and future providers. This sprint does not implement any provider runtime behavior, sync, credential handling, iframe embedding, OAuth flow, LTI flow, or external LMS API calls.

Student PWA impact: establishes the first-class PWA surface, route structure, read-model expectations, offline behavior, installability goals, and student/guardian visibility rules.

ShepherdAI impact: records future student action reminder boundaries. ShepherdAI may later suggest Academy-owned actions such as registration tasks, document requests, schedule conflicts, or released academic progress review. It must not infer spiritual condition, counseling needs, LMS engagement, devotional activity, giving behavior, or pastoral care status.

Security/privacy impact: student PWA routes expose academic records and may include minors. Future implementation must enforce tenant isolation, student self-scope, active guardian relationship checks, release-state filtering, transcript hold filtering, role-scoped staff preview behavior, offline cache minimization, and no provider secret exposure.

## Current Context

Phase 1 established tenant-level institution configuration, operating rules, capabilities, repository/API read paths, admin review UI, and the base tenant/admin boundary.

Phase 2 established academic calendars, periods, windows, and subdivisions for semesters, quarters, trimesters, school years, and rolling modules.

Phase 3 established course catalogs, sections, delivery modes, instructor-readiness review, and provider-neutral LMS mapping references.

Phase 4 established people, role assignments, student profiles, guardian relationships, staff profiles, relationship-scoped access, repository read paths, and admin review UI.

Phase 5 established grading, evaluation scales, official-record rules, transcript/progress/completion rules, standing/promotion/graduation evaluators, persistence, API read path, and admin review UI.

The Student PWA can now be designed against real Academy domains instead of mock-only student pages.

## Problem

ChurchCore Academy needs a student-facing PWA that fits very different faith-based institutions without becoming a college-only portal:

- Bible school students may need module schedules, completion status, clock-hour progress, practicum requirements, documents, messages, and LMS launch.
- Children's schools may need guardian-mediated access, grade-band schedules, report cards, narrative progress, documents, pickup/contact constraints, and carefully limited offline data.
- Seminaries may need term schedules, field education requirements, transcript holds, degree progress, advisor messages, and course shell launch.
- Colleges and universities may need schedules, courses, grades, standing, graduation readiness, registration tasks, documents, messages, and LMS launch.
- Mixed institutions may need one PWA shell that changes behavior by student profile, subdivision, grade band, and institution capabilities.

If Academy builds the PWA as a generic dashboard that reads raw tables, it will leak administrative setup data, draft grades, unreleased records, provider secrets, or other students' records. If Academy builds the PWA as a thin LMS front door, it will undermine the SIS boundary and fail no-LMS institutions.

## Design Goals

1. Treat the Student PWA as a first-class Academy surface, not a marketing page or LMS wrapper.
2. Use student-scoped read models, not raw institution, people, grading, or course configuration tables.
3. Support student self-access and active guardian relationship-scoped access with the same privacy model defined in Phase 4.
4. Expose only released, PWA-visible academic records from Phase 5 evaluators and future official-record read models.
5. Support mode-specific language and content for Bible school, children's school, seminary, college, university, and mixed institutions.
6. Keep LMS launch provider-neutral until Phase 7 defines the provider contract.
7. Keep offline behavior conservative: cache shell and non-sensitive summaries first; do not cache provider secrets, unpublished grades, transcript holds, or cross-student guardian data.
8. Define reviewable implementation slices for route shell, read models, documents/progress, and installability verification.
9. Require browser verification for desktop and mobile student layouts.
10. Preserve accessibility, responsive layout, and installability as sprint requirements instead of late polish.

## Non-Goals

- Do not implement PWA routes, manifest, service worker, API routes, read models, UI, or browser tests in this sprint.
- Do not add student editing, registration, payment, document upload, grade dispute, transcript request, or messaging workflows in this sprint.
- Do not implement Moodle, Canvas, LTI, OAuth, SSO, or provider API calls in this sprint.
- Do not store LMS provider credentials, OAuth tokens, launch secrets, or external session tokens in PWA-visible data.
- Do not expose raw official-record entries until release and hold policies are implemented in a student-scoped read model.
- Do not expose guardian access through tenant-wide role checks.
- Do not implement push notifications, background sync, or offline mutations in the first PWA implementation slices.
- Do not build a separate children's school app, college app, or Bible school app.

## Options Considered

### Option A: College-Style Student Portal

Build the first PWA around a conventional college dashboard: schedule, grades, transcript, registration, and LMS links.

Pros:

- familiar to college and university users
- maps to many SIS expectations
- fast to explain

Cons:

- weak fit for children's school guardian mediation
- weak fit for Bible school completion and clock-hour programs
- encourages semester, credit, GPA, and transcript assumptions
- risks exposing transcript concepts where progress or completion records are the real model

Decision: rejected.

### Option B: LMS-First PWA

Make the student PWA primarily a launchpad for Moodle or Canvas.

Pros:

- reduces early Academy UI scope
- may feel familiar to institutions already using an LMS
- makes course activity easy to locate once providers exist

Cons:

- fails no-LMS mode
- makes external providers feel like the system of record
- encourages provider-specific runtime code before the provider contract exists
- cannot reliably handle official transcripts, guardian visibility, graduation audit, or Academy-owned documents

Decision: rejected.

### Option C: Academy Read-Model PWA

Build the Student PWA from Academy-owned, student-scoped read models. The shell adapts to institution mode and capability flags. LMS launch appears as a provider-neutral action only after provider contract work defines it.

Pros:

- preserves Academy as the SIS system of record
- supports Bible school, children's school, seminary, college, university, and mixed institutions
- lets tests focus on data exposure boundaries
- works in no-LMS mode
- keeps future Moodle and Canvas integration behind a provider-neutral contract
- gives offline behavior a controlled data surface

Cons:

- requires read-model work before rich UI
- requires careful release-state and guardian filtering
- requires clear empty states while LMS contract work is pending

Decision: accepted.

### Option D: Separate PWA Per Institution Mode

Create different student apps for children's school, Bible school, seminary, college, and university modes.

Pros:

- each mode can use very specific language
- reduces conditional rendering inside one route tree

Cons:

- duplicates navigation, privacy checks, offline strategy, installability setup, and tests
- makes mixed institutions harder
- increases maintenance burden

Decision: rejected.

## Accepted Design

ChurchCore Academy will implement one Student PWA route family backed by student-scoped read models.

The PWA shell will be capability-aware:

- institutions with `studentPwa` disabled do not expose student PWA routes
- children's schools can require guardian-first access where operating rules demand guardians
- transcript-bearing institutions can show released transcript/standing concepts when the official record model permits release
- Bible schools can show completion, clock-hour, practicum, and certificate progress without requiring GPA or transcripts
- no-LMS institutions show Academy schedule/course actions without external launch buttons
- LMS-enabled institutions show launch placeholders only through the future provider contract

The PWA must be designed as a constrained operating surface, not a raw data browser.

## Route Structure

Future implementation should prefer a student route group with predictable child routes:

```text
src/app/student/
  layout.tsx
  page.tsx
  courses/page.tsx
  schedule/page.tsx
  progress/page.tsx
  documents/page.tsx
  messages/page.tsx
  lms/page.tsx
```

The first runtime sprint should build only the shell, manifest, navigation, and safe placeholder panels. Later sprints should add read models and data-bound pages.

Recommended route semantics:

- `/student`: student dashboard summary
- `/student/courses`: current sections, instructors, meeting patterns, delivery mode, and course status
- `/student/schedule`: academic-period schedule, meetings, registration windows, and date-sensitive tasks
- `/student/progress`: released grades, completion, standing, promotion, and graduation readiness summaries
- `/student/documents`: Academy-owned documents and requests
- `/student/messages`: Academy-owned administrative messages and action reminders
- `/student/lms`: provider-neutral course launch actions after Phase 7

## Student And Guardian Access Model

Student PWA reads must resolve an actor to an Academy person before loading student data.

Allowed student contexts:

- a student actor can read only their own PWA-visible student record
- an adult student can read their own student record without guardian mediation
- a guardian actor can read only categories allowed by an active relationship to a specific student
- a staff actor previewing student PWA data must use a separate staff-preview path with audit semantics, not impersonate a student silently

Denied contexts:

- tenant-wide guardian role without an active relationship to the target student
- expired, inactive, emergency-contact-only, or pickup-only relationships for academic data
- cross-tenant student records
- student access to another student's schedule, grades, documents, or messages
- guardian access to categories not listed in the relationship visibility policy

## PWA Read Models

Future implementation should create focused read models instead of exposing raw domain records.

Recommended read-model modules:

```text
src/modules/student-pwa/student-access.ts
src/modules/student-pwa/dashboard-read-model.ts
src/modules/student-pwa/course-read-model.ts
src/modules/student-pwa/progress-read-model.ts
src/modules/student-pwa/document-read-model.ts
src/modules/student-pwa/lms-launch-read-model.ts
```

Read models should consume existing repository outputs and evaluators:

- institution profile and operating rules
- academic calendar and active periods
- course catalog and sections
- people and guardian relationships
- grading configuration, official-record evaluator output, and standing evaluator output
- future document/message sources
- future provider-neutral LMS launch contract

Read models must return display-ready objects with release-state decisions already applied.

## Offline And Installability Strategy

The first PWA implementation should use conservative offline support:

- add a manifest with Academy student branding, icons, display mode, theme colors, and start URL
- cache static shell assets through framework-supported PWA behavior when introduced
- allow loading a safe shell and empty states when offline
- avoid offline caching of full academic records until explicit cache invalidation, encryption posture, and logout purge behavior are implemented
- avoid background sync and offline mutations in early sprints

Sensitive data that must not be stored offline in early implementation:

- unreleased grades
- transcript hold details
- official record audit details
- cross-student guardian data
- provider launch secrets
- OAuth tokens
- provider access tokens
- counseling, pastoral care, giving, devotional, or other non-Academy data

## UI Principles

The PWA should start as the actual student experience, not a landing page.

The interface should be quiet, operational, and easy to scan:

- bottom or compact navigation for mobile
- clear route headings without oversized marketing hero sections
- compact course, schedule, progress, and task summaries
- mode-aware labels such as Completion, Progress, Report Card, Standing, or Transcript only when supported
- no nested cards
- no purely decorative gradients or ornamental backgrounds
- accessible focus states, landmarks, and labels
- responsive layouts verified on mobile and desktop

## LMS Boundary

The Student PWA may display LMS launch availability only through a provider-neutral model.

Before Phase 7:

- show LMS capability as unavailable, pending setup, or no-LMS based on existing Academy configuration only
- do not call Moodle or Canvas APIs
- do not store Moodle or Canvas URLs, tokens, API keys, OAuth credentials, launch secrets, or LTI secrets in student-visible models
- do not infer course progress from LMS engagement

After Phase 7:

- launch actions should come from the provider-neutral LMS contract
- unavailable providers should produce clear user-safe states
- provider sync failures should be shown as administrative setup state only when appropriate for students

## ShepherdAI Boundary

Future ShepherdAI student reminders may use Academy-owned data:

- registration window open
- missing required document
- course setup action available
- released grade or progress record available
- academic standing review available
- graduation readiness item missing
- LMS launch configured for enrolled section after provider contract exists

Forbidden signal sources:

- Moodle/Canvas engagement, clicks, views, or time-on-task
- spiritual condition or devotional behavior
- counseling, pastoral care, discipline, or giving data
- inferred family status beyond explicit guardian relationship records
- private staff notes

## Validation And Tests For Future Sprints

Future implementation must include tests for:

- student reads own record
- student cannot read another student's record
- guardian with active full relationship can read allowed categories
- expired guardian relationship cannot read PWA data
- emergency contact cannot read academic data
- pickup contact cannot read academic data
- cross-tenant access is denied before category filtering
- unreleased grades are hidden
- transcript holds are respected
- no-LMS institutions do not show provider launch actions
- LMS-enabled institutions do not expose provider secrets
- children's school mode can hide direct student access when guardian-first access is required
- mixed institutions show the correct mode-specific labels for each student

Browser verification must cover:

- `/student` desktop layout
- `/student` mobile layout
- no console errors
- no overlapping navigation or cards
- keyboard navigation through primary route controls
- installability check once a manifest is added
- offline shell behavior once service-worker or framework PWA support is added

## Security And Privacy Review Points

- Student PWA read paths must use tenant ID and resolved Academy person ID.
- Guardian reads must use active relationship records, not guardian role alone.
- PWA-visible categories must be allowlisted.
- Official records must be filtered by release state and hold policy.
- Offline storage must be explicitly reviewed before caching student academic data.
- Staff preview must be auditable and visually distinct from student self-access.
- Provider launch data must not include provider secrets or credentials.
- Browser screenshots must not include sensitive real data in committed artifacts.

## ADRs Required

- ADR 0012: Student PWA Routing And Offline Strategy
- ADR 0013: Student PWA Data Exposure Model

## Review Boundary

This sprint is complete when the Student PWA design package, ADRs, roadmap updates, and master-plan updates are reviewable.

No runtime PWA routes, manifest, service worker, read models, API routes, UI components, migrations, LMS adapters, or ShepherdAI runtime behavior should change in this sprint.

## Next Sprint

Phase 6 Sprint 2 should implement the Student PWA shell and manifest.

It should add the route group, app manifest metadata, navigation shell, safe placeholder panels, no-LMS/pending-LMS states, and browser verification for desktop and mobile. It should not add full student read models, official grade display, document storage, messaging, LMS provider calls, or offline caching of sensitive academic records.
