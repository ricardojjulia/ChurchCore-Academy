# Institution Type And Operating Rules Design

## Factory Intake

Feature: Phase 1, Sprint 1 institution type and operating rules design package.

Product area: Institution Configuration.

Primary users:

- institution administrators
- academic administrators
- registrar staff
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

LMS provider impact: establishes provider-selection rules, but does not implement LMS integration.

Student PWA impact: establishes institution-mode flags that future PWA routes may use.

ShepherdAI impact: establishes allowed Academy-owned institution signals for future deterministic recommendations.

Auth and privacy risks: no runtime data is changed in this sprint, but the design requires tenant isolation, role-scoped access, and auditability for future implementation.

## Current Context

ChurchCore Academy currently has Academy dataset types, mock data, ShepherdAI workflow recommendations, academic workflow services, API routes, and Supabase/Postgres scaffolding. It does not yet have a tenant-level institution configuration domain.

This sprint produces the design package that later implementation sprints must follow.

## Problem

The platform must support Bible schools, children's schools, seminaries, colleges, and universities without separate products or hardcoded institution assumptions.

Every downstream domain depends on this first model:

- academic calendar
- subdivisions
- course catalog
- grading
- people and roles
- student PWA
- LMS provider selection
- ShepherdAI Academy recommendations

If this model is too narrow, later features will need branching logic by institution type. If it is too broad, implementation will become vague and hard to validate.

## Design Goals

1. Keep the first institution model small and stable.
2. Support multiple faith-based institution modes from one tenant configuration.
3. Separate descriptive institution type from operational rules.
4. Avoid encoding LMS provider behavior in Academy domain logic.
5. Make future migrations tenant-aware.
6. Make future admin UI reviewable without requiring every downstream domain.

## Non-Goals

- Do not implement database tables in this sprint.
- Do not implement UI in this sprint.
- Do not implement auth in this sprint.
- Do not implement LMS provider adapters in this sprint.
- Do not implement grading, calendar, course, people, or PWA runtime behavior in this sprint.

## Options Considered

### Option A: Single Institution Type Enum

Each tenant chooses one institution type: Bible school, children's school, seminary, college, or university.

Pros:

- simple
- easy to display
- easy to seed

Cons:

- fails mixed institutions
- forces branching when an institution has both children's school and college programs
- cannot express operating differences like term model, grading style, or guardian support

Decision: rejected.

### Option B: Feature Flag Matrix Only

Each tenant enables capabilities such as guardians, transcript rules, GPA, cohorts, LMS, and student PWA.

Pros:

- flexible
- avoids type labels becoming too important

Cons:

- loses helpful institution identity
- harder for onboarding and product language
- harder to reason about Bible school vs children's school vs university defaults

Decision: rejected.

### Option C: Institution Mode Plus Operating Rules

Each tenant has one or more institution modes and a separate operating-rules object.

Pros:

- supports mixed institutions
- preserves clear product language
- allows safe defaults by institution mode
- keeps operational behavior explicit and testable

Cons:

- slightly more modeling work
- requires clear validation rules

Decision: accepted.

## Accepted Design

ChurchCore Academy will model institution configuration with:

1. `InstitutionProfile`
2. `InstitutionMode`
3. `InstitutionOperatingRules`
4. `InstitutionCapabilitySet`
5. `InstitutionLmsPreference`

The institution profile describes the tenant. Institution modes describe what kind of educational institution the tenant operates. Operating rules describe how the institution runs. Capabilities describe which product surfaces and records are enabled. LMS preference describes whether the tenant uses no LMS, Moodle, Canvas, or an unconfigured provider state.

## Domain Model

### InstitutionProfile

Required fields:

- `tenantId`
- `institutionName`
- `legalName`
- `primaryMode`
- `supportedModes`
- `operatingRules`
- `capabilities`
- `lmsPreference`
- `createdAt`
- `updatedAt`

Rules:

- `tenantId` is the durable tenant boundary.
- `primaryMode` must be one of `supportedModes`.
- `supportedModes` must contain at least one mode.
- `institutionName` is display-facing.
- `legalName` is official-record-facing.

### InstitutionMode

Allowed values:

- `bible_school`
- `childrens_school`
- `seminary`
- `college`
- `university`
- `mixed`

Rules:

- `mixed` may be primary only when at least two other modes are supported.
- `childrens_school` enables guardian-capable defaults.
- `college`, `seminary`, and `university` enable transcript and credential defaults.
- `bible_school` enables certificate and ministry-training defaults.

### InstitutionOperatingRules

Fields:

- `academicYearLabel`
- `defaultCalendarSystem`
- `defaultTermStructure`
- `usesGradeLevels`
- `usesPrograms`
- `usesCohorts`
- `usesCredits`
- `usesClockHours`
- `usesGpa`
- `usesTranscripts`
- `usesGuardians`
- `allowsMinors`
- `defaultInstructionalRoleLabel`
- `officialRecordName`

Allowed values:

- `defaultCalendarSystem`: `school_year`, `academic_year`, `rolling_enrollment`
- `defaultTermStructure`: `semester`, `quarter`, `trimester`, `module`, `year_round`, `custom`
- `defaultInstructionalRoleLabel`: `teacher`, `professor`, `instructor`, `faculty`
- `officialRecordName`: `transcript`, `progress_record`, `completion_record`

Rules:

- `usesGuardians` must be true when `allowsMinors` is true.
- `usesGradeLevels` is recommended for children's school mode.
- `usesCredits` or `usesClockHours` must be true for transcript-bearing postsecondary modes.
- `usesTranscripts` must be true for college, seminary, and university defaults unless explicitly disabled in a future migration with audit rationale.

### InstitutionCapabilitySet

Fields:

- `studentPwa`
- `guardianPortal`
- `facultyPortal`
- `registrarWorkflows`
- `admissionsWorkflows`
- `transcriptWorkflows`
- `graduationWorkflows`
- `lmsLaunch`
- `lmsRosterSync`
- `lmsGradeReturn`
- `shepherdAiRecommendations`

Rules:

- `guardianPortal` requires `usesGuardians`.
- `lmsRosterSync` and `lmsGradeReturn` require an LMS provider other than `none`.
- `shepherdAiRecommendations` may only use Academy-owned records.

### InstitutionLmsPreference

Fields:

- `provider`
- `selectionStatus`
- `notes`

Allowed `provider` values:

- `none`
- `moodle`
- `canvas`
- `unconfigured`

Allowed `selectionStatus` values:

- `not_needed`
- `planned`
- `active`
- `paused`
- `migration_required`

Rules:

- `none` with `not_needed` is valid.
- `unconfigured` is valid during onboarding only.
- Moodle and Canvas behavior must remain behind provider-neutral contracts.

## Suggested Defaults

### Bible School

- calendar: academic year
- term structure: module or semester
- grade levels: false
- programs: true
- cohorts: true
- credits: optional
- clock hours: optional
- GPA: optional
- transcripts: optional
- guardians: false by default
- instructional role: instructor
- LMS provider: none or Moodle

### Children's School

- calendar: school year
- term structure: trimester or semester
- grade levels: true
- programs: false by default
- cohorts: true
- credits: false by default
- clock hours: false by default
- GPA: optional
- transcripts: progress record by default
- guardians: true
- minors: true
- instructional role: teacher
- LMS provider: none or Moodle

### Seminary

- calendar: academic year
- term structure: semester or module
- grade levels: false
- programs: true
- cohorts: true
- credits: true
- clock hours: optional
- GPA: true
- transcripts: true
- guardians: false by default
- instructional role: professor
- LMS provider: Moodle or Canvas

### College

- calendar: academic year
- term structure: semester or quarter
- grade levels: false
- programs: true
- cohorts: true
- credits: true
- clock hours: optional
- GPA: true
- transcripts: true
- guardians: false by default
- instructional role: professor
- LMS provider: Moodle or Canvas

### University

- calendar: academic year
- term structure: semester, quarter, or custom
- grade levels: false
- programs: true
- cohorts: true
- credits: true
- clock hours: optional
- GPA: true
- transcripts: true
- guardians: false by default
- instructional role: faculty
- LMS provider: Canvas or Moodle

## Validation Rules

Future implementation must validate:

- supported modes are non-empty
- primary mode appears in supported modes
- mixed primary mode includes at least two concrete modes
- minors require guardians
- guardian portal requires guardian support
- LMS sync capabilities require Moodle or Canvas provider
- postsecondary transcript defaults include credits or clock hours
- official record name matches enabled academic record behavior

## Security And Privacy

Future implementation must enforce:

- tenant isolation on every institution configuration read and write
- institution admin permissions for editing operating rules
- audit events for changes to modes, transcript capability, guardian capability, LMS preference, and ShepherdAI capability
- no public exposure of configuration that reveals minors, guardian policies, or provider credentials

## ShepherdAI Boundary

ShepherdAI may later use institution configuration as context for deterministic recommendations such as:

- missing required institution setup
- conflicting operating rules
- LMS provider selected but sync disabled
- guardian portal enabled without guardian-capable mode
- transcript workflow enabled without transcript-capable rules

ShepherdAI must not infer spiritual condition, student character, family status, devotional activity, giving, counseling history, or LMS engagement meaning.

## Future Files

Likely implementation files in later sprints:

- `src/modules/academy-config/types.ts`
- `src/modules/academy-config/defaults.ts`
- `src/modules/academy-config/validation.ts`
- `src/modules/academy-config/__tests__/institution-config.test.ts`
- `supabase/migrations/*_academy_institution_config.sql`
- `src/modules/academy-config/postgres-repository.ts`
- `src/app/api/academy/config/institution/route.ts`
- `src/app/settings/institution/page.tsx`

## Acceptance Criteria For This Sprint

- design package exists
- accepted ADR exists
- implementation plan exists
- no runtime behavior changes
- future implementation boundaries are clear
- verification commands pass
