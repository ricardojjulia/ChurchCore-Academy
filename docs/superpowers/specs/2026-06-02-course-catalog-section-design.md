# Course Catalog And Section Design

## Factory Intake

Feature: Phase 3, Sprint 1 course catalog and section design package.

Product area: Course Catalog, Sections, Instructional Assignment, and LMS Mapping References.

Primary users:

- institution administrators
- academic administrators
- registrar staff
- deans, department chairs, and school directors
- teachers, professors, and instructional coordinators
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

LMS provider impact: defines provider-neutral LMS shell mapping references for future Moodle, Canvas, and no-LMS adapters. It does not implement LMS runtime behavior.

Student PWA impact: establishes future course, section, schedule, instructor, and LMS launch references for student-facing pages.

ShepherdAI impact: establishes future Academy-owned setup signals for missing instructors, missing section schedules, missing grade mode, over-capacity rosters, incomplete course shells, and unresolved LMS mappings.

Auth and privacy risks: no runtime data changes in this sprint, but the design requires tenant-scoped course data, role-scoped administration, student-visible section filtering, guardian visibility review for children's schools, and no provider tokens inside course catalog records.

## Current Context

Phase 1 established tenant-level institution configuration, operating rules, API read paths, admin review UI, and tenant/admin access policy.

Phase 2 established academic calendar and subdivision design, types, validation, persistence, seed data, repository read path, API read path, and admin review UI.

The course catalog now has stable upstream references:

- `InstitutionProfile` for institution mode, transcript, credit, clock-hour, guardian, and instructional role defaults
- `AcademicYear` and `AcademicPeriod` for offerings, sections, modules, sessions, terms, and grading windows
- `InstitutionSubdivision` for schools, departments, grade bands, cohorts, and mixed-institution branches

This sprint designs the next layer without adding runtime code.

## Problem

ChurchCore Academy must support courses and sections across very different faith-based education models.

Examples:

- A Bible school may offer short ministry modules, certificate courses, practicums, clock-hour instruction, cohort-based intensives, and completion records.
- A children's school may offer grade-level classes, homeroom-style sections, narrative or competency evaluation, guardian-visible schedules, and teacher-led rooms instead of professors and departments.
- A seminary may offer graduate courses, intensives, field education, prerequisites, credit hours, and department ownership.
- A college may offer general education, major requirements, electives, labs, internships, practica, credits, sections, and transcripts.
- A university may offer multiple schools, departments, campuses, cross-listed courses, lectures, labs, seminars, and provider-mapped LMS shells.
- A mixed institution may run several of these under one tenant.

If the course model assumes college-only credits, semester sections, and professor-owned classes, it will not fit Bible schools, children's schools, or mixed institutions.

## Design Goals

1. Separate catalog identity from scheduled section delivery.
2. Support credit, clock-hour, competency, narrative, completion, and non-transcript course records.
3. Support Bible modules, children's school classes, seminary intensives, college courses, university sections, labs, practica, internships, and ministry formation requirements.
4. Let courses reference institution subdivisions without forcing every tenant into a department model.
5. Let sections reference academic periods without hardcoding semesters.
6. Allow teachers and professors as instructional staff while keeping people/role persistence for a later phase.
7. Preserve a provider-neutral LMS mapping boundary.
8. Make future validation deterministic and testable.
9. Keep Academy as the SIS system of record.

## Non-Goals

- Do not implement TypeScript course types in this sprint.
- Do not implement database tables in this sprint.
- Do not implement course APIs or repositories in this sprint.
- Do not implement course setup UI in this sprint.
- Do not implement instructor assignment workflows in this sprint.
- Do not implement LMS provider adapters in this sprint.
- Do not implement grading, transcript, student PWA, or ShepherdAI runtime behavior in this sprint.
- Do not store Moodle, Canvas, or other LMS runtime credentials in course catalog records.

## Options Considered

### Option A: College Course Catalog Model

Model courses as credit-bearing catalog records with semester sections.

Pros:

- familiar for colleges, seminaries, and universities
- simple transcript and degree-audit mapping
- easy LMS mapping for common higher-education courses

Cons:

- poor fit for children's school classes
- poor fit for Bible school modules and clock-hour certificates
- forces non-credit and narrative courses into exceptions
- encourages semester assumptions in downstream PWA and LMS behavior

Decision: rejected.

### Option B: Fully Custom Learning Activities

Model every course, class, practicum, module, and activity as a generic learning activity with arbitrary flags.

Pros:

- very flexible
- can represent unusual institutions
- avoids many tables at first

Cons:

- too vague for transcript, grade, LMS, and validation logic
- makes admin setup harder
- makes student PWA schedule behavior hard to infer
- invites inconsistent tenant data

Decision: rejected.

### Option C: Catalog Course Plus Scheduled Section

Use a catalog-level `Course` for durable academic identity and a scheduled `CourseSection` for period-specific delivery.

Pros:

- supports repeatable catalog entries across years and terms
- supports modules, classes, sections, labs, intensives, practica, and internships
- allows section-level instructor, capacity, schedule, LMS shell, and enrollment behavior
- keeps transcript and course history stable

Cons:

- requires clear validation between catalog defaults and section overrides
- requires careful naming for children's school classes where catalog and section may appear similar

Decision: accepted.

### Option D: LMS-First Course Shell Model

Create course records as local shadows of Moodle or Canvas course shells.

Pros:

- simple if every institution uses one LMS
- closely matches provider course provisioning

Cons:

- breaks no-LMS mode
- couples Academy domain logic to provider behavior
- makes provider migration difficult
- weak fit for children's schools or institutions that use LMS only for some courses

Decision: rejected.

### Option E: Provider-Neutral LMS Mapping References

Keep Academy course and section records as the source of truth, then attach provider-neutral mapping references that future adapters can use.

Pros:

- supports Moodle, Canvas, and no-LMS mode
- lets Academy own academic records
- keeps provider-specific APIs, tokens, failures, and sync state out of the course model
- supports choosing or changing LMS provider later

Cons:

- requires adapter contract work in a later phase
- cannot assume all sections have an LMS shell

Decision: accepted.

## Accepted Design

ChurchCore Academy will model Phase 3 with three cooperating concepts:

1. Catalog courses: durable academic definitions.
2. Course sections: period-specific offerings and delivery instances.
3. Course relationships and mappings: prerequisites, cross-listing, instructional assignment references, and provider-neutral LMS shell references.

The course catalog must not own grading-scale implementation, transcript calculation, student enrollment persistence, LMS runtime behavior, or person/role persistence. It should provide stable references for those future domains.

## Domain Model

### CourseCatalogProfile

Purpose: tenant-level course catalog settings derived from institution operating rules.

Fields:

- `tenantId`
- `defaultCourseRecordType`
- `defaultDurationUnit`
- `supportsCredits`
- `supportsClockHours`
- `supportsCompetencies`
- `supportsNarrativeEvaluation`
- `supportsGradeLevels`
- `supportsLmsMapping`
- `createdAt`
- `updatedAt`

Rules:

- `tenantId` must match the institution profile tenant.
- Credit support must align with the institution operating rules.
- Clock-hour support must align with Bible school, certificate, practicum, or continuing education modes.
- Grade-level support must align with children's school mode.
- LMS mapping support does not imply a provider is configured.

### Course

Purpose: durable catalog identity for an academic offering.

Fields:

- `id`
- `tenantId`
- `code`
- `title`
- `description`
- `courseType`
- `courseLevel`
- `recordType`
- `defaultDuration`
- `defaultCredits`
- `defaultClockHours`
- `defaultCompetencySetId`
- `owningSubdivisionId`
- `gradeBandSubdivisionId`
- `status`
- `createdAt`
- `updatedAt`

Course types:

- `bible_course`
- `general_education`
- `major_requirement`
- `elective`
- `seminary_course`
- `ministry_practicum`
- `internship`
- `lab`
- `children_class`
- `homeroom`
- `chapel`
- `custom`

Course levels:

- `children`
- `certificate`
- `undergraduate`
- `graduate`
- `continuing_education`
- `mixed`

Record types:

- `transcript`
- `completion_record`
- `progress_report`
- `attendance_only`
- `non_record`

Allowed status values:

- `draft`
- `active`
- `archived`

Rules:

- Course codes must be unique per tenant and owning subdivision while active.
- Transcript-bearing postsecondary courses require credits or clock hours.
- Children's school classes require grade-band or mode-specific subdivision context.
- Bible school ministry modules may use clock hours, completion records, or competencies without credits.
- Courses can be institution-wide when the tenant is small, but mixed institutions should scope courses to a branch or school subdivision.
- Archived courses remain referenceable by historical sections.

### CourseDuration

Purpose: describe the expected size of a course without assuming all institutions use credits.

Fields:

- `durationUnit`
- `durationValue`
- `instructionalMinutes`
- `creditHours`
- `clockHours`
- `competencyCount`

Duration units:

- `credit_hour`
- `clock_hour`
- `instructional_day`
- `week`
- `module`
- `semester`
- `trimester`
- `quarter`
- `custom`

Rules:

- A duration can include multiple measures when the institution needs both credit and clock-hour tracking.
- Credit-bearing courses require positive `creditHours`.
- Clock-hour courses require positive `clockHours`.
- Children's school classes may use instructional days or weeks instead of credits.
- Competency courses require a future competency set reference before they can be marked ready for grading.

### CourseSection

Purpose: scheduled or offered instance of a catalog course.

Fields:

- `id`
- `tenantId`
- `courseId`
- `academicYearId`
- `academicPeriodId`
- `subdivisionId`
- `sectionCode`
- `titleOverride`
- `deliveryMode`
- `schedulePattern`
- `capacity`
- `status`
- `primaryInstructorRole`
- `primaryInstructorId`
- `assistantInstructorIds`
- `lmsMappingId`
- `createdAt`
- `updatedAt`

Delivery modes:

- `in_person`
- `online`
- `hybrid`
- `independent_study`
- `field_practicum`
- `chapel`
- `custom`

Section statuses:

- `draft`
- `scheduled`
- `open`
- `in_progress`
- `completed`
- `cancelled`
- `archived`

Rules:

- `tenantId` must match the course, academic year, academic period, and subdivision references.
- A section must reference a catalog course.
- A section must reference an academic period before it can open for registration or appear in student schedules.
- Capacity is optional for small programs but required when waitlist or over-capacity workflows are enabled.
- Instructor assignment may be missing in draft but should produce a setup warning before `open` or `in_progress`.
- Children's school sections may use teacher labels and grade-band context.
- College, seminary, and university sections may use professor, instructor, or faculty labels depending on institution rules.

### CoursePrerequisite

Purpose: define academic requirements before a student can register for or complete a course.

Fields:

- `id`
- `tenantId`
- `courseId`
- `requiredCourseId`
- `requirementType`
- `minimumGradeRuleId`
- `notes`
- `createdAt`
- `updatedAt`

Requirement types:

- `required_before_registration`
- `required_before_completion`
- `recommended`
- `corequisite`
- `placement_required`

Rules:

- Course and prerequisite must be in the same tenant.
- Circular prerequisite chains are invalid.
- Minimum grade rules belong to the future grading domain.
- Placement requirements may reference future admissions or assessment records, not LMS activity.

### CourseLmsMapping

Purpose: provider-neutral reference that future LMS adapters can use to create, locate, or reconcile course shells.

Fields:

- `id`
- `tenantId`
- `courseId`
- `sectionId`
- `provider`
- `mappingStatus`
- `externalCourseKey`
- `externalSectionKey`
- `syncPolicy`
- `lastReviewedAt`
- `createdAt`
- `updatedAt`

Providers:

- `none`
- `moodle`
- `canvas`
- `external`

Mapping statuses:

- `not_required`
- `planned`
- `ready_to_provision`
- `mapped`
- `needs_review`
- `disabled`

Sync policies:

- `manual`
- `provision_shell_only`
- `roster_sync`
- `grade_return`
- `full_section_sync`

Rules:

- A no-LMS institution can keep mappings at `not_required`.
- Provider-specific credentials, tokens, API URLs, sync attempts, retries, and webhook payloads do not belong in this record.
- A section may have no LMS mapping when it is in-person, attendance-only, or otherwise outside LMS delivery.
- Grade return mapping cannot be enabled until the future grading contract exists.
- Roster sync mapping cannot be enabled until the future people/enrollment model exists.

## Validation Rules By Institution Mode

### Bible School

- Supports Bible courses, ministry practica, intensives, modules, and certificate courses.
- May use completion records instead of transcripts.
- May use clock hours or competencies instead of credits.
- Sections may be cohort-scoped.
- LMS mapping is optional and must not be required for no-LMS mode.

### Children's School

- Requires grade-band context for grade-level classes.
- Supports teacher-led sections and homerooms.
- May use progress reports, narrative evaluation, attendance-only records, or competencies.
- Guardian-visible schedules must be reviewed before student PWA exposure.
- Transcript-oriented fields should not be required unless explicitly enabled.

### Seminary

- Supports graduate courses, intensives, departments, practica, field education, credits, and transcripts.
- Sections may be term, session, or intensive scoped.
- Prerequisites and program requirements are expected for many courses.
- Professor or faculty assignment should be required before sections open.

### College

- Supports credit-bearing catalog courses, general education, major requirements, electives, labs, internships, sections, and transcripts.
- Sections should have academic period references and instructor assignments before opening.
- LMS mapping may be planned or required by tenant policy but remains provider-neutral.

### University

- Supports schools, departments, campuses, cross-listed courses, lectures, labs, seminars, practica, and multiple section types.
- Owning subdivision should usually be required for active courses.
- Cross-listing must preserve one source catalog course or explicit linked courses to avoid duplicate transcript records.

### Mixed Institution

- Active courses should be scoped to a subdivision branch or institution mode unless they are intentionally shared.
- Validation must prevent a children's school class from inheriting college-only credit requirements by accident.
- Validation must prevent a Bible school completion module from being forced into transcript-only behavior.

## Future Repository And API Boundary

Future implementation should add a tenant-scoped repository that can read:

- course catalog profile
- active and archived catalog courses
- course prerequisites
- course sections by academic period and subdivision
- provider-neutral LMS mapping references

The first API read path should be read-only and use the same institution configuration reader roles as calendar configuration:

- institution admin
- dean
- registrar
- academic admin

Write paths should wait until the course validation model, audit requirements, and role model are stable.

## Admin UI Boundary

The first course UI should be an admin review page, not an editor.

Expected review sections:

- catalog profile
- course type coverage
- active courses by subdivision/mode
- sections by academic period
- missing instructor warnings
- missing duration or credit/clock-hour warnings
- LMS mapping readiness
- validation warnings

Editable catalog workflows should wait until persistence, audit, and role rules are implemented.

## LMS Boundary

Academy owns course and section records.

LMS providers may later consume mappings to provision shells, map sections, sync rosters, return grades, or reconcile progress. Those behaviors belong in the provider-neutral LMS contract and provider adapters, not in course catalog domain logic.

Course catalog records may store provider-neutral mapping status and external keys. They must not store:

- provider OAuth tokens
- provider API secrets
- sync retry state
- webhook payloads
- LMS-only activity data
- LMS engagement metrics

## Student PWA Boundary

Future student PWA course views may consume:

- section title
- course code
- period
- schedule pattern
- instructor display names
- delivery mode
- LMS launch availability
- enrollment status

The student PWA must not expose unpublished sections, hidden instructor notes, provider secrets, or administrative setup warnings.

Guardian views for children's school mode need separate review before exposure.

## ShepherdAI Boundary

Future ShepherdAI recommendations may use Academy-owned course setup data, such as:

- active section missing primary instructor
- section scheduled outside academic period bounds
- course missing duration
- transcript-bearing course missing credit or clock-hour measure
- section marked for LMS sync without mapping readiness
- over-capacity section when capacity is configured

ShepherdAI must not use:

- LMS engagement or activity data
- spiritual condition inferences
- counseling records
- giving records
- devotional or pastoral care signals
- provider-only course analytics

Recommendations must remain deterministic, explainable, and human-reviewed.

## Security And Privacy

Course catalog and section data must be tenant-scoped.

Future write paths must include:

- role-scoped access
- audit records for changes that affect transcripts, graduation, billing, LMS provisioning, or student schedules
- protection against cross-tenant course, period, subdivision, prerequisite, and mapping references
- careful student and guardian visibility rules

## Review Checklist For Later Implementation

- Course and section types support all institution modes.
- Credits and clock hours are optional by model but required by validation where appropriate.
- Children's school classes do not require college transcript fields by default.
- Bible school modules can use completion records, clock hours, or competencies.
- Sections reference academic periods without assuming semesters.
- Courses and sections can reference subdivisions without forcing departments.
- LMS mapping records remain provider-neutral.
- Provider-specific runtime data stays outside course catalog tables.
- Student PWA exposure rules are explicit.
- ShepherdAI allowed and forbidden signals are explicit.

## Next Sprint Recommendation

Phase 3 Sprint 2 should implement TypeScript course catalog and section types plus validation tests in a new `src/modules/course-catalog/` module.

It should not add persistence, API routes, admin UI, LMS adapter behavior, student PWA behavior, or ShepherdAI runtime behavior.
