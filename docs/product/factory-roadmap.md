# ChurchCore Academy Factory Roadmap

## Current Position

ChurchCore Academy is at Phase 1, Phase 2, and Phase 3 complete, with Phase 4 in progress.

Completed:

- product vision and boundary
- faith-based education management positioning
- platform design spec
- implementation master plan
- LMS provider strategy
- software factory definition
- Codex/Superpowers requirement
- baseline verification with `npm test`, `npm run lint`, and `npm run build`

Not started:

- grading and transcript domain
- student PWA
- LMS provider contract
- Moodle adapter
- Canvas adapter
- ShepherdAI expansion on the full Academy model

## Sprint Cadence

ChurchCore Academy uses 1-week factory sprints.

Each sprint has one reviewable outcome. A sprint may produce docs, domain code, migrations, tests, UI, or provider-contract work, but it must end with a clear artifact that can be reviewed independently.

## Weekly Sprint Shape

### Day 1: Intake And Discovery

- confirm product area
- identify institution modes affected
- inspect current docs, code, tests, and schemas
- identify student, guardian, grade, transcript, LMS, and ShepherdAI risks
- decide whether an ADR is required

### Day 2: Design And Plan

- compare viable approaches
- update or create design notes
- create the sprint execution package
- define files, tests, migrations, review gates, and verification commands

### Days 3-4: Implementation

- execute scoped tasks
- write tests before or alongside implementation
- keep changes inside the sprint boundary
- update docs when behavior, architecture, or operations change

### Day 5: Verification And Review

- run required checks
- perform software-factory review
- write delivery notes
- decide ship, revise, defer, or split

## Reviewable Boundaries

A sprint boundary is valid only when it can be reviewed without requiring unrelated future work.

Valid sprint boundaries:

- one domain model with tests
- one migration and repository set
- one admin review surface
- one student PWA workflow
- one provider-neutral LMS interface
- one provider adapter capability slice
- one ShepherdAI signal category with tests and explanation rules
- one ADR-backed architectural decision

Invalid sprint boundaries:

- partial work that only compiles after a later sprint
- mixed changes across unrelated domains
- LMS provider logic embedded in Academy business logic
- UI without data-boundary review
- schema changes without seed or migration verification
- ShepherdAI signals without forbidden-source tests

## Phase Plan

### Phase 0: Product And Factory Foundation

Status: complete.

Reviewable outcome:

- durable product vision
- software factory
- master plan
- platform spec
- LMS strategy
- baseline verification

### Phase 1: Institution Configuration Core

Goal: define the tenant-level institution model that all other domains depend on.

Suggested 1-week sprints:

1. Institution type and operating rules design package - complete
2. Institution configuration types and tests - complete
3. Institution configuration migration and seed data - complete
4. Institution configuration repository and API read path - complete
5. Admin review UI for institution configuration - complete
6. Tenant isolation, admin permissions, and configuration closeout - complete

Review boundary:

- no grading, calendar, course, or LMS implementation until the institution model is stable enough to reference.

Required ADRs:

- institution type model
- tenant isolation strategy for Academy configuration

### Phase 2: Academic Calendar And Sub-Divisions

Goal: support academic years, terms, sessions, modules, and institutional subdivisions.

Suggested 1-week sprints:

1. Academic calendar design package - complete
2. Calendar and term types with validation tests - complete
3. Calendar migrations, seed data, and repository - complete
4. Calendar configuration API read path - complete
5. Admin calendar review UI - complete

Required ADRs:

- academic period model
- subdivision hierarchy model

### Phase 3: Course Catalog And Sections

Goal: support course types, course durations, sections, prerequisites, instructors, and LMS mapping references.

Suggested 1-week sprints:

1. Course catalog design package - complete
2. Course and section types with tests - complete
3. Course migrations, seed data, and repository - complete
4. Course catalog API read path - complete
5. Course setup review UI - complete

Required ADRs:

- course duration and credit/clock-hour model
- LMS course shell mapping boundary

### Phase 4: People, Roles, Guardians, Faculty

Goal: define users and role boundaries for students, guardians, teachers, professors, faculty, advisors, and administrators.

Suggested 1-week sprints:

1. Role and people design package - complete
2. Person and relationship types with tests - complete
3. Guardian relationship model - complete
4. Role-scoped API access patterns - complete
5. People persistence, seed data, and repository read path - complete
6. People and role admin review UI - complete

Required ADRs:

- role and permission model
- guardian access model

### Phase 5: Grading And Transcript Rules

Goal: support grading scales, grading types, GPA, pass/fail, competency, narrative evaluation, transcripts, promotion, and graduation rules.

Suggested 1-week sprints:

1. Grading and transcript design package - complete
2. Grading type and scale types with tests - complete
3. Transcript rule evaluator - complete
4. Academic standing and promotion evaluator - complete
5. Grading persistence seed data and repository read path - complete
6. Grading configuration API read path - complete
7. Grading review UI - complete

Required ADRs:

- grading model
- transcript and audit model

### Phase 6: Student PWA

Goal: provide a student-facing PWA for schedule, courses, grades, documents, progress, messages, registration, and LMS launch.

Suggested 1-week sprints:

1. Student PWA design package
2. Student PWA shell and manifest
3. Student dashboard read models
4. Student documents and progress surface
5. PWA installability and offline verification

Required ADRs:

- student PWA routing and offline strategy
- student data exposure model

### Phase 7: LMS Contract And No-LMS Mode

Goal: define the provider-neutral LMS contract and support institutions without an LMS.

Suggested 1-week sprints:

1. LMS contract design package
2. Provider-neutral interfaces and contract tests
3. No-LMS provider implementation
4. Tenant provider selection
5. Sync audit and reconciliation model

Required ADRs:

- LMS provider contract
- provider selection and capability model

### Phase 8: Moodle Adapter

Goal: implement Moodle as the first LMS provider through the provider-neutral contract.

Suggested 1-week sprints:

1. Moodle adapter design package
2. Moodle identity and launch mapping
3. Moodle course and roster sync
4. Moodle grade/progress return
5. Moodle reconciliation and provider docs

Required ADRs:

- Moodle adapter integration model
- Moodle credential and endpoint storage model

### Phase 9: Canvas Adapter

Goal: implement Canvas as the second LMS provider through the same contract.

Suggested 1-week sprints:

1. Canvas adapter design package
2. Canvas identity and launch mapping
3. Canvas course and roster sync
4. Canvas grade/progress return
5. Canvas capability matrix and provider docs

Required ADRs:

- Canvas adapter integration model
- Canvas OAuth and token storage model

### Phase 10: ShepherdAI Expansion

Goal: expand ShepherdAI after the Academy data model exists.

Suggested 1-week sprints:

1. ShepherdAI expansion design package
2. Institution configuration gap signals
3. Academic calendar and course setup signals
4. Grading and transcript readiness signals
5. Student PWA action reminder signals

Required ADRs:

- ShepherdAI allowed signal policy
- ShepherdAI explanation and forbidden-source policy

## Sprint Exit Decision

At the end of every sprint, choose one:

- ship: artifact is verified and reviewable
- revise: artifact is close but needs bounded follow-up
- defer: artifact is valid but blocked by a missing dependency
- split: scope was too large and must become smaller sprints
- reject: approach violates product boundary or creates unacceptable risk
