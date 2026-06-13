# ChurchCore Academy Factory Roadmap

## Current Position

ChurchCore Academy has broad design and prototype coverage through the LMS adapter phases. Production MVP work is now governed by the approved five-release remediation program. Earlier phase completion means the design package or tested domain slice exists; it does not mean the corresponding operational workflow is production-complete.

Completed:

- product vision and boundary
- faith-based education management positioning
- platform design spec
- implementation master plan
- LMS provider strategy
- software factory definition
- Codex/Superpowers requirement
- institution configuration core
- academic calendar and sub-divisions
- course catalog and sections
- people, roles, guardians, and faculty
- grading and transcript rules
- student PWA shell, dashboard read surfaces, installability, and safe offline fallback
- LMS contract design package
- provider-neutral LMS interfaces and contract tests
- no-LMS provider implementation
- tenant provider selection
- sync audit and reconciliation model
- Moodle adapter design package
- Moodle identity and launch mapping
- Moodle course and roster sync
- Moodle grade/progress return
- Moodle reconciliation and provider docs
- baseline verification with `npm test`, `npm run lint`, and `npm run build`
- Release 1 verified-session authentication and safe API error mapping
- Release 1 RLS and immutable audit migration
- Release 1 protected-page removal of seeded runtime records
- Release 2 Slice 1 persistent admissions application-to-decision workflow
- Release 2 Slice 1 authenticated admissions APIs and staff review page
- Release 2 Slice 1 tenant-aware admissions constraints, forced RLS, idempotency, and immutable events

In progress:

- live role-by-role RLS and browser verification
- dependency and supported Node runtime remediation

Next:

- close the Release 1 production security exit gate
- convert accepted applications into student, enrollment, and registration transactions
- execute attendance, grade entry, transcript issuance, and persistent Student PWA slices

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

1. Student PWA design package - complete
2. Student PWA shell and manifest - complete
3. Student dashboard read models - complete
4. Student documents and progress surface - complete
5. PWA installability and offline verification - complete

Required ADRs:

- student PWA routing and offline strategy
- student data exposure model

### Phase 7: LMS Contract And No-LMS Mode

Goal: define the provider-neutral LMS contract and support institutions without an LMS.

Suggested 1-week sprints:

1. LMS contract design package - complete
2. Provider-neutral interfaces and contract tests - complete
3. No-LMS provider implementation - complete
4. Tenant provider selection - complete
5. Sync audit and reconciliation model - complete

Required ADRs:

- LMS provider contract
- provider selection and capability model

### Phase 8: Moodle Adapter

Goal: implement Moodle as the first LMS provider through the provider-neutral contract.

Suggested 1-week sprints:

1. Moodle adapter design package - complete
2. Moodle identity and launch mapping - complete
3. Moodle course and roster sync - complete
4. Moodle grade/progress return - complete
5. Moodle reconciliation and provider docs - complete

Required ADRs:

- Moodle adapter integration model - complete
- Moodle credential and endpoint storage model - complete

### Phase 9: Canvas Adapter

Goal: implement Canvas as the second LMS provider through the same contract.

Status: substantially complete (Sprints 1–7 delivered — launch mapping, course/roster sync, grade/progress return, reconciliation, Student PWA bridge, runtime orchestration, and production auth wiring).

Required ADRs:

- Canvas adapter integration model
- Canvas OAuth and token storage model

### Phase 10: ShepherdAI Expansion

Goal: expand ShepherdAI signals and workflow coverage after the Academy data model exists.

Suggested 1-week sprints:

1. ShepherdAI expansion design package
2. Institution configuration gap signals
3. Academic calendar and course setup signals
4. Grading and transcript readiness signals
5. Student PWA action reminder signals
6. Academic early alert signal set (GPA, credits, holds, formation gaps)
7. Graduation readiness audit and workflow suggestions
8. Advising caseload intelligence and communication cadence signals
9. Academic standing change detection and notification workflow
10. Faculty load and qualification compliance signals

Required ADRs:

- ShepherdAI allowed signal policy
- ShepherdAI explanation and forbidden-source policy

### Phase 11: Admissions and Enrollment CRM

Goal: support inquiry-to-enrolled lifecycle for all institution types.

Suggested 1-week sprints:

1. Application draft, submission, and acceptance slice - complete
2. Application form builder and program-specific requirements
3. Application fee collection and submission workflow
4. Lead pipeline, stages, and bulk communication
5. Reference collection and document checklist
6. Enrollment agreement workflow
7. Accepted-application conversion, enrollment confirmation, and SIS record creation

Required ADRs:

- Admissions and enrollment pipeline model

### Phase 12: Student Billing and Accounts

Goal: automate tuition billing, payment collection, and account statements.

Suggested 1-week sprints:

1. Billing design package
2. Tuition schedule and fee rule engine
3. Student account and invoice model
4. Payment collection (Stripe integration)
5. Payment plans and recurring billing
6. Billing admin view and aging report
7. Accounting software export

Required ADRs:

- Student billing and payment model

### Phase 13: Financial Aid Management

Goal: support institutional scholarships, FAFSA integration, and SAP tracking.

Suggested 1-week sprints:

1. Financial aid design package
2. Institutional scholarship and grant model
3. FAFSA/ISIR import and aid application
4. Aid packaging and offer letter
5. COD sync for Title IV institutions
6. SAP tracking and ShepherdAI SAP alerts

Required ADRs:

- Financial aid model and Title IV boundary

### Phase 14: Ministry Formation Records

Goal: track non-graded formation and spiritual development records as first-class Academy domain objects.

Suggested 1-week sprints:

1. Formation design package
2. Formation category and requirement model
3. Formation record entry and advisor assignment
4. Formation progress view for student and advisor
5. Formation release policy and graduation readiness integration
6. ShepherdAI formation gap signal

Required ADRs:

- Formation record domain model and transcript boundary

### Phase 15: Competency and Narrative Evaluation Expansion

Goal: support competency frameworks, narrative evaluations, and children's school progress records as grading types.

Suggested 1-week sprints:

1. Competency design package
2. Competency framework builder and level definitions
3. Competency-to-course mapping
4. Competency transcript format
5. Narrative evaluation entry and guardian-releasable records

Required ADRs:

- Competency evaluation model (extends ADR-0010)

### Phase 16: Compliance and Accreditation Reporting

Goal: native ATS Standards and IPEDS reporting for accredited institutions.

Suggested 1-week sprints:

1. Reporting design package
2. ATS student data reporting templates
3. IPEDS enrollment and completion reports
4. Custom report builder with save/export
5. FERPA consent management and access log

### Phase 17: Faculty Portal and Qualification Records

Goal: grade entry, attendance, advising notes, and credential qualification tracking.

### Phase 18: Alumni and Ministry Placement

Goal: post-graduation relationship tracking, ministry placement, and alumni directory.

### Phase 19: Denomination and Church Partner Access

Goal: sponsoring church visibility into their students' progress, scoped and consent-gated.

### Phase 20: Certificate and CEU Programs

Goal: non-degree completion records, continuing education unit tracking, and digital credential issuance.

### Phase 21: International and Multilingual Support

Goal: multilingual student-facing portals, international document tracking, and multi-currency tuition.

### Phase 22: Donor and Fundraising CRM

Goal: donor profiles, campaign management, and online donation collection.

## Sprint Exit Decision

At the end of every sprint, choose one:

- ship: artifact is verified and reviewable
- revise: artifact is close but needs bounded follow-up
- defer: artifact is valid but blocked by a missing dependency
- split: scope was too large and must become smaller sprints
- reject: approach violates product boundary or creates unacceptable risk
