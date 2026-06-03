# Academic Calendar And Subdivision Design

## Factory Intake

Feature: Phase 2, Sprint 1 academic calendar and subdivision design package.

Product area: Academic Calendar and Institutional Structure.

Primary users:

- institution administrators
- academic administrators
- registrar staff
- deans and school directors
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

LMS provider impact: establishes future calendar and subdivision references that LMS course shells, roster sync, and grade-return windows may use. It does not implement LMS integration.

Student PWA impact: establishes future schedule, term, cohort, grade-band, campus, and school context for student-facing pages.

ShepherdAI impact: establishes future Academy-owned signals for calendar setup gaps, enrollment-window conflicts, grading-window issues, and subdivision assignment gaps.

Auth and privacy risks: no runtime data is changed in this sprint, but the design requires tenant-scoped periods, role-scoped administration, auditability for date changes, and careful guardian visibility for children's school records.

## Current Context

Phase 1 established the tenant-level institution model, persistence, API read path, admin review UI, and institution configuration permission boundary.

The institution profile already contains default calendar hints:

- `defaultCalendarSystem`: `school_year`, `academic_year`, or `rolling_enrollment`
- `defaultTermStructure`: `semester`, `quarter`, `trimester`, `module`, `year_round`, or `custom`
- operating flags for grade levels, programs, cohorts, credits, clock hours, transcripts, guardians, and minors

This sprint turns those hints into a design for concrete academic calendars and institutional subdivisions without adding runtime code.

## Problem

The platform must support very different faith-based education models without hardcoding a college-style semester calendar.

Examples:

- A children's school may operate by school year, trimester, grade band, homeroom cohort, and guardian-facing progress periods.
- A Bible school may operate by rolling enrollment, short modules, cohorts, clock hours, and certificate completion records.
- A seminary may operate by academic year, semester, intensive sessions, departments, credit hours, and transcript periods.
- A college or university may operate by academic year, terms, sessions, schools, departments, programs, credits, grading windows, and graduation cycles.
- A mixed institution may run more than one of these structures under the same tenant.

If calendar and subdivision design assumes semesters, departments, and degree cohorts only, later PWA, LMS, grading, transcript, and registrar workflows will carry the wrong assumptions.

## Design Goals

1. Separate time structure from organizational structure.
2. Support school-year, academic-year, rolling-enrollment, module, and year-round calendars.
3. Support campuses, schools, departments, divisions, grade bands, cohorts, and programs without requiring every institution to use all of them.
4. Keep date windows explicit for enrollment, instruction, grading, transcript posting, and graduation readiness.
5. Make future validation deterministic and testable.
6. Preserve tenant isolation and the institution-admin permission boundary from Phase 1.
7. Avoid LMS-provider assumptions in Academy calendar logic.

## Non-Goals

- Do not implement TypeScript calendar types in this sprint.
- Do not implement database tables in this sprint.
- Do not implement calendar or subdivision UI in this sprint.
- Do not implement editable configuration endpoints in this sprint.
- Do not implement LMS provider adapters in this sprint.
- Do not implement grading, transcript, course catalog, or student PWA runtime behavior in this sprint.

## Options Considered

### Option A: College Semester Model

Model academic years with semester terms and optional summer sessions.

Pros:

- familiar for colleges and seminaries
- simple transcript mapping
- easy to reason about credits

Cons:

- weak fit for children's schools that use school years, grade bands, and trimesters
- weak fit for modular Bible schools and rolling enrollment
- forces exceptions for modules, year-round programs, and mixed institutions

Decision: rejected.

### Option B: Fully Custom Date Ranges

Let every tenant create arbitrary named date ranges and attach behavior through flags.

Pros:

- very flexible
- can model unusual institutions

Cons:

- too vague for validation
- makes UI setup harder
- makes downstream grading, transcript, LMS, and PWA behavior difficult to infer
- invites inconsistent tenant data

Decision: rejected.

### Option C: Calendar System Plus Period Hierarchy

Use a tenant calendar system, academic years, period types, and explicit windows. Let terms, sessions, modules, grading windows, and transcript periods be typed records rather than hardcoded semesters.

Pros:

- supports children's schools, Bible schools, seminaries, colleges, universities, and mixed institutions
- preserves useful defaults from `InstitutionProfile`
- keeps validation possible
- avoids LMS-specific assumptions

Cons:

- requires more modeling discipline than a simple semester table
- requires clear parent-child rules between academic years, terms, sessions, and modules

Decision: accepted.

### Option D: Single Organization Tree

Model every structural concept as a generic tree node.

Pros:

- very flexible
- can represent campuses, schools, departments, divisions, and grade bands with one table

Cons:

- loses useful type-specific validation
- makes grade-band and cohort behavior unclear
- makes staff-facing setup less understandable

Decision: rejected as the only model, but accepted as inspiration for parent-child relationships.

### Option E: Typed Subdivisions With Optional Parent Links

Use typed subdivision records for campus, school, department, division, grade band, and cohort. Each record has a tenant boundary and optional parent relationships constrained by type.

Pros:

- understandable to institutions
- supports small schools and universities
- supports children's school grade bands without forcing departments
- supports mixed institutions with separate branches

Cons:

- requires validation by subdivision type
- requires careful naming so "school" can mean a college within a university, not the whole tenant

Decision: accepted.

## Accepted Design

ChurchCore Academy will model Phase 2 with two cooperating domains:

1. Academic periods: how an institution divides time.
2. Institutional subdivisions: how an institution organizes people, courses, grade levels, programs, and cohorts.

The domains meet at references:

- a term, session, or module may be scoped to a subdivision
- a cohort may be attached to one or more academic periods
- enrollment windows, grading windows, transcript periods, and graduation review periods belong to academic periods
- student PWA schedules and LMS mappings later consume academic period and subdivision IDs

The domains must remain separate so that a campus or department can survive across many years, while terms and sessions can roll over annually.

## Academic Period Domain

### AcademicCalendarProfile

Purpose: tenant-level calendar settings derived from the institution profile.

Fields:

- `tenantId`
- `calendarSystem`
- `defaultTermStructure`
- `timezone`
- `weekStartsOn`
- `usesInstructionalDays`
- `usesEnrollmentWindows`
- `usesGradingWindows`
- `usesTranscriptPeriods`
- `createdAt`
- `updatedAt`

Rules:

- `tenantId` must match the institution profile tenant.
- `calendarSystem` must align with the institution operating rules unless an admin override is recorded later.
- `timezone` is required before date validations can run.
- `weekStartsOn` supports Monday or Sunday defaults without embedding regional assumptions.

### AcademicYear

Purpose: top-level named year or cycle.

Fields:

- `id`
- `tenantId`
- `name`
- `code`
- `startsOn`
- `endsOn`
- `status`
- `calendarSystem`
- `subdivisionId`
- `createdAt`
- `updatedAt`

Allowed status values:

- `draft`
- `active`
- `archived`

Rules:

- Dates are inclusive.
- `startsOn` must be before `endsOn`.
- Active years for the same tenant and subdivision must not overlap.
- A rolling-enrollment Bible school may still use an annual reporting year for completion records.
- A mixed institution may have multiple active academic years when scoped to different subdivisions, such as a children's school and a seminary branch.

### AcademicPeriod

Purpose: typed child period under an academic year.

Fields:

- `id`
- `tenantId`
- `academicYearId`
- `parentPeriodId`
- `subdivisionId`
- `name`
- `code`
- `periodType`
- `startsOn`
- `endsOn`
- `sequence`
- `status`
- `createdAt`
- `updatedAt`

Allowed `periodType` values:

- `term`
- `session`
- `module`
- `intensive`
- `grading_period`
- `reporting_period`
- `break`

Rules:

- Period dates must fall inside the academic year.
- Child period dates must fall inside the parent period when `parentPeriodId` is present.
- Periods with instructional types may overlap only when the calendar permits concurrent sessions.
- `sequence` controls display order and transcript ordering.
- `break` periods cannot be used as enrollment or grading targets.

### EnrollmentWindow

Purpose: records when applications, enrollment, registration, add/drop, or withdrawal are allowed.

Fields:

- `id`
- `tenantId`
- `academicPeriodId`
- `windowType`
- `opensAt`
- `closesAt`
- `appliesToSubdivisionId`
- `createdAt`
- `updatedAt`

Allowed `windowType` values:

- `application`
- `enrollment`
- `registration`
- `add_drop`
- `withdrawal`

Rules:

- Window close time must be after open time.
- Registration and add/drop windows must reference an instructional period.
- Children's school enrollment windows may apply to grade bands.
- Bible school rolling enrollment may use open-ended application windows only when explicitly allowed by calendar profile.

### GradingWindow

Purpose: controls when teachers, professors, or faculty can enter grades or progress records.

Fields:

- `id`
- `tenantId`
- `academicPeriodId`
- `opensAt`
- `closesAt`
- `gradePostingPolicy`
- `createdAt`
- `updatedAt`

Allowed `gradePostingPolicy` values:

- `manual_review`
- `auto_post_after_close`
- `registrar_posting`

Rules:

- Grading window must close after the instructional period ends unless the period type is `grading_period`.
- Grade posting policy does not define grading scale. Grading scale belongs to Phase 5.
- Children's school progress reporting can use grading windows without transcripts.

### TranscriptPeriod

Purpose: marks official record posting periods.

Fields:

- `id`
- `tenantId`
- `academicPeriodId`
- `recordType`
- `postingOpensAt`
- `postingClosesAt`
- `createdAt`
- `updatedAt`

Allowed `recordType` values:

- `transcript`
- `progress_record`
- `completion_record`

Rules:

- `recordType` must align with the institution official record name unless an audited override is added later.
- Transcript periods are required for credit-bearing college, seminary, and university configurations.
- Completion-record periods are valid for Bible schools using clock hours or module completion.

## Subdivision Domain

### InstitutionSubdivision

Purpose: typed organizational unit inside a tenant.

Fields:

- `id`
- `tenantId`
- `parentSubdivisionId`
- `name`
- `code`
- `subdivisionType`
- `institutionMode`
- `status`
- `createdAt`
- `updatedAt`

Allowed `subdivisionType` values:

- `campus`
- `school`
- `department`
- `division`
- `grade_band`
- `cohort`

Allowed status values:

- `draft`
- `active`
- `archived`

Rules:

- Every subdivision is tenant-scoped.
- Parent and child subdivisions must belong to the same tenant.
- A subdivision may be mode-scoped, such as `childrens_school` or `seminary`, or shared by a mixed institution.
- Archiving a subdivision does not delete historical period, enrollment, course, or transcript references.

### Campus

Purpose: location or delivery branch.

Rules:

- A campus may contain schools, departments, divisions, grade bands, or cohorts.
- Online-only institutions may use a virtual campus or no campus if the tenant design allows it.
- LMS provider choice remains tenant-level by default; campus-specific provider variation requires a later LMS ADR.

### School

Purpose: major academic unit inside a larger institution, such as School of Ministry or Children's Academy.

Rules:

- A school may contain departments, divisions, grade bands, and cohorts.
- The school subdivision must not be confused with the tenant institution itself.
- A small Bible school may skip school subdivisions entirely.

### Department

Purpose: academic department or subject-area unit.

Rules:

- Departments are most useful for colleges, seminaries, and universities.
- Children's schools may use divisions or grade bands instead.
- Departments may later own course catalogs, faculty assignment defaults, and LMS shell mapping references.

### Division

Purpose: flexible administrative grouping such as Lower School, Upper School, Undergraduate, Graduate, or Extension.

Rules:

- Divisions may contain grade bands, departments, cohorts, or programs.
- Divisions are optional and should not be required for simple institutions.

### GradeBand

Purpose: children's school grouping such as K-2, 3-5, Middle School, or High School.

Rules:

- Grade bands are only required when `usesGradeLevels` is true.
- Grade bands may be attached to enrollment windows and progress reporting periods.
- Guardian visibility rules must be reviewed before grade-band records appear in the student PWA.

### Cohort

Purpose: student group moving through a program, module sequence, class year, or admissions intake.

Rules:

- Cohorts may be tied to an academic year, term, module sequence, or rolling-enrollment intake.
- Cohorts may exist in Bible school, children's school, seminary, college, university, and mixed modes.
- Cohorts are not the same as course sections; course sections belong to Phase 3.

## Institution Mode Defaults

### Bible School

Recommended calendar:

- `calendarSystem`: `rolling_enrollment` or `academic_year`
- `periodType`: `module`, `intensive`, or `reporting_period`
- official record: completion record

Recommended subdivisions:

- campus optional
- school optional
- department optional
- division optional
- cohort recommended for ministry-training tracks

Validation emphasis:

- modules may be shorter than terms
- clock-hour and completion windows must be supported
- no transcript requirement unless the tenant enables transcript behavior

### Children's School

Recommended calendar:

- `calendarSystem`: `school_year`
- `periodType`: `term`, `grading_period`, or `reporting_period`
- common structures: trimester, quarter, or year-round
- official record: progress record

Recommended subdivisions:

- campus optional
- school optional
- division recommended for lower, middle, and upper school
- grade band recommended
- cohort or homeroom group optional

Validation emphasis:

- grade bands required when grade levels are enabled
- guardian visibility must be considered before PWA exposure
- enrollment windows may apply by grade band

### Seminary

Recommended calendar:

- `calendarSystem`: `academic_year`
- `periodType`: `term`, `session`, `intensive`
- common structures: semester, module, or intensive sessions
- official record: transcript

Recommended subdivisions:

- school optional
- department recommended for theology, biblical studies, ministry practice, or counseling
- cohort optional

Validation emphasis:

- transcript periods required when transcripts are enabled
- grading windows should support intensive courses
- LMS shell mapping may later need session-level references

### College

Recommended calendar:

- `calendarSystem`: `academic_year`
- `periodType`: `term`, `session`, `grading_period`
- common structures: semester or quarter
- official record: transcript

Recommended subdivisions:

- campus optional
- school optional
- department recommended
- cohort optional

Validation emphasis:

- active terms cannot overlap unless concurrent sessions are explicitly allowed
- transcript periods required
- enrollment and add/drop windows required before registration workflows are enabled

### University

Recommended calendar:

- `calendarSystem`: `academic_year`
- `periodType`: `term`, `session`, `grading_period`
- common structures: semester, quarter, or multiple school-specific calendars
- official record: transcript

Recommended subdivisions:

- campus optional or recommended
- school recommended
- department recommended
- division optional
- cohort optional

Validation emphasis:

- multiple schools may have separate calendars under one tenant
- academic years may be scoped to subdivisions
- cross-school course enrollment requires later course-catalog rules

### Mixed Institution

Recommended calendar:

- may use multiple academic years scoped by subdivision
- may combine school-year children's school periods with postsecondary academic-year periods
- may use rolling modules for Bible school tracks

Recommended subdivisions:

- at least one subdivision branch per concrete institution mode
- each branch should declare its institution mode
- shared campus is allowed

Validation emphasis:

- do not force one calendar onto all branches
- prevent cross-tenant references
- allow shared students or faculty only after people-and-roles rules exist

## Validation Rules For Future Implementation

Calendar validation must reject:

- academic years with invalid date order
- overlapping active academic years for the same tenant and subdivision
- periods outside their academic year
- child periods outside parent periods
- enrollment windows with invalid open/close order
- grading windows that close before they open
- transcript periods for tenants that do not use transcripts unless the record type is `completion_record` or `progress_record`
- registration windows attached to `break` periods
- school-year children's school setups without grade bands when grade levels are enabled
- mixed institutions without mode-scoped subdivision branches

Calendar validation must allow:

- rolling enrollment with open reporting periods
- Bible school module sequences
- seminary intensive sessions inside a term
- children's school trimester or quarter progress periods
- university subdivision-scoped academic years
- multiple active academic years when they are scoped to different subdivision branches

## Security And Privacy Boundaries

- Every period, window, and subdivision must include `tenantId`.
- Every read and write must use the Academy tenant/admin policy established in ADR 0003.
- Date changes that affect enrollment, grading, transcript posting, graduation review, or student PWA visibility require audit history in a future implementation sprint.
- Guardian-facing children's school records must not be exposed until guardian relationship and permission rules exist.
- LMS sync must consume period and subdivision references through a provider-neutral contract, not provider-specific calendar logic.
- ShepherdAI may recommend setup reviews for missing or conflicting Academy-owned calendar data only.

## Future ShepherdAI Signals

Allowed future signal categories:

- academic year missing for an active tenant
- active term missing for a postsecondary institution
- grade-band setup missing for children's school mode
- enrollment window overlaps or date conflicts
- grading window missing for active instructional period
- transcript period missing for transcript-bearing mode
- mixed institution branch missing for a supported concrete mode

Forbidden future signal sources:

- LMS engagement data
- spiritual condition
- counseling data
- giving data
- devotional behavior
- inferred family or student intent

## Future UI Expectations

The admin review UI should eventually show:

- active academic year
- term/session/module list
- enrollment windows
- grading windows
- transcript or progress-record windows
- subdivision tree
- grade bands and cohorts
- validation warnings

The first UI should remain review-first. Editing should wait until audit behavior and role-scoped mutation endpoints are available.

## Sprint Boundary

This sprint completes when the design package, ADRs, and execution package are reviewable.

No runtime calendar, subdivision, database, API, or UI implementation belongs in this sprint.

## Next Sprint

Phase 2 Sprint 2 should implement TypeScript types and validation tests for academic calendar and subdivision configuration in a new module, likely `src/modules/academic-calendar/`, without adding persistence or UI.
