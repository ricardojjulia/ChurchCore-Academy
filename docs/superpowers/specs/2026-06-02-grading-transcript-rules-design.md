# Grading And Transcript Rules Design

## Factory Intake

Feature: Phase 5, Sprint 1 grading and transcript rules design package.

Product area: Grading, Evaluation, Official Records, Promotion, Graduation, and Academic Standing.

Primary users:

- institution administrators
- academic administrators
- registrar staff
- deans, school directors, and department chairs
- teachers, professors, faculty, and instructional staff
- advisors
- students
- guardians for children's school mode
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

LMS provider impact: defines future provider-neutral grade-return and gradebook import boundaries for Moodle, Canvas, no-LMS, and external providers. It does not implement provider sync, grade passback, LMS gradebook reads, or provider credentials.

Student PWA impact: establishes future student and guardian visibility boundaries for grades, progress records, completion status, transcripts, standing, promotion, and graduation readiness.

ShepherdAI impact: establishes future Academy-owned academic record signals for missing grade rules, unposted final evaluations, transcript holds, credit/GPA pace, promotion readiness, and graduation blockers. It does not allow spiritual condition, counseling, devotional participation, giving, or raw LMS engagement signals.

Auth and privacy risks: grading and transcript data is high-sensitivity academic record data. Future implementation must use tenant-scoped reads and writes, role-scoped grade entry, registrar-controlled official posting, guardian visibility rules for minors, audit history for changes, and denial of provider credential storage.

## Current Context

Phase 1 established tenant-level institution configuration, operating rules, API read paths, admin review UI, and tenant/admin access policy.

Phase 2 established academic calendars, periods, windows, subdivisions, persistence, API read path, and admin review UI.

Phase 3 established course catalog, course durations, sections, record types, provider-neutral LMS mappings, persistence, API read path, and course setup review UI.

Phase 4 established people, role assignments, guardian relationships, faculty/staff profiles, role-scoped access patterns, persistence, repository read path, and people/role admin review UI.

The grading and transcript layer can now reference stable upstream concepts:

- `InstitutionProfile` for mode-specific transcript, guardian, GPA, credit, clock-hour, and official-record rules
- `AcademicYear`, `AcademicPeriod`, grading windows, and transcript periods for posting timelines
- `Course`, `CourseSection`, duration, record type, and LMS mapping references
- `Person`, `StudentProfile`, `StaffProfile`, and role assignments for student, instructor, advisor, guardian, registrar, and admin boundaries

This sprint designs the next layer without adding runtime code.

## Problem

ChurchCore Academy must support academic evaluation across institutions that do not share one grading model.

Examples:

- A Bible school may need pass/fail completion, clock-hour attendance thresholds, ministry practicum approvals, competency checklists, and certificate completion records.
- A children's school may need narrative evaluation, standards or competency progress, grade-band promotion, guardian-visible progress records, and non-GPA report cards.
- A seminary may need graduate letter grades, pass/fail practica, field education evaluations, transcript holds, academic probation, and degree audit.
- A college may need credits, GPA, repeated-course rules, transfer credits, graduation audit, honors, and transcript posting.
- A university may need multiple grading scales by school, undergraduate and graduate level rules, departments, terms, transcript periods, degree programs, and repeat/forgiveness policies.
- A mixed institution may run all of these under one tenant.

If Academy hardcodes a college-only gradebook or transcript, it will not fit children's schools or Bible schools. If it makes every evaluation fully generic, transcript, promotion, graduation, and audit behavior will become inconsistent and hard to test.

## Design Goals

1. Separate course evaluation from official record posting.
2. Support letter grades, numeric percentages, pass/fail, completion, competency, narrative, attendance-only, and custom evaluation types.
3. Support GPA-bearing and non-GPA records in the same tenant.
4. Support credits, clock hours, competencies, narrative progress, and completion records without forcing every course into transcripts.
5. Support children's school promotion and guardian-visible progress without exposing all academic records to every guardian.
6. Support Bible school certificate completion and ministry practicum records.
7. Support seminary, college, and university transcripts, academic standing, degree audit, and graduation readiness.
8. Preserve registrar-controlled official posting, transcript periods, audit history, and grade-change review.
9. Keep LMS grade-return provider-neutral and optional.
10. Make validation, transcript calculation, promotion checks, and graduation checks deterministic and testable.

## Non-Goals

- Do not implement TypeScript grading or transcript types in this sprint.
- Do not implement database tables or migrations in this sprint.
- Do not implement grade entry, grade posting, transcript, promotion, or graduation evaluators in this sprint.
- Do not implement grading APIs or repositories in this sprint.
- Do not implement grading or transcript admin UI in this sprint.
- Do not implement LMS grade sync or grade passback in this sprint.
- Do not implement student PWA grade pages in this sprint.
- Do not implement ShepherdAI runtime recommendations in this sprint.
- Do not store Moodle, Canvas, or other provider tokens in grading records.

## Options Considered

### Option A: College Transcript Model Only

Model grading as credit-bearing courses, letter grades, grade points, GPA, terms, and transcripts.

Pros:

- familiar to colleges, seminaries, and universities
- straightforward GPA and transcript calculations
- compatible with common SIS and LMS gradebook workflows

Cons:

- poor fit for children's school narrative progress
- poor fit for Bible school completion certificates and ministry practica
- forces non-GPA and competency records into exceptions
- encourages transcript assumptions in courses that only need progress or attendance records

Decision: rejected.

### Option B: Generic Evaluation Blob

Store every grade, narrative, competency, progress, and completion record as generic JSON.

Pros:

- flexible
- easy to ingest from many sources
- can represent unusual institutions

Cons:

- weak auditability
- hard to validate
- hard to compute GPA, standing, promotion, transcript, and graduation consistently
- high risk of inconsistent tenant data
- difficult for future agents to reason about safely

Decision: rejected.

### Option C: Evaluation Type Plus Official Record Rules

Use typed evaluation rules for course/section outcomes and separate official record rules for transcript, progress, completion, promotion, and graduation posting.

Pros:

- supports GPA and non-GPA models
- supports children, Bible school, seminary, college, university, and mixed tenants
- makes validation deterministic
- separates instructor evaluation from registrar official posting
- supports provider-neutral LMS grade return without making LMS the source of truth

Cons:

- more domain objects than a flat grade table
- requires clear UI wording around draft evaluations, posted records, and official transcripts

Decision: accepted.

### Option D: LMS Gradebook As Source Of Truth

Treat Moodle or Canvas gradebooks as the authoritative grading source and sync results into Academy.

Pros:

- convenient for institutions that already grade entirely in an LMS
- can reduce duplicate grade entry for online courses

Cons:

- breaks no-LMS mode
- weak fit for children's school narrative progress and registrar-controlled transcripts
- couples official records to provider sync reliability
- makes provider migration difficult
- risks importing gradebook details that should not become official SIS records

Decision: rejected.

### Option E: Provider-Neutral Grade Return

Keep Academy as the academic record source of truth while allowing future Moodle, Canvas, and external adapters to submit grade-return payloads into reviewed Academy evaluation records.

Pros:

- supports Moodle, Canvas, no-LMS, and future providers
- keeps official record posting in Academy
- allows validation before grade return becomes official
- supports provider migration and mixed provider/no-provider sections

Cons:

- requires adapter contract work later
- requires reconciliation and audit handling for imported values

Decision: accepted.

## Accepted Design

ChurchCore Academy will model grading and official records with five cooperating concepts:

1. Grading profile: tenant-level grading, posting, transcript, GPA, and promotion posture.
2. Evaluation rule set: the allowed evaluation type, scale, pass/completion logic, competency logic, narrative requirements, and calculation policy for a course or section.
3. Evaluation result: instructor- or provider-submitted student outcome records, initially draft or submitted.
4. Official record entry: registrar-posted records used for transcript, progress report, completion record, promotion, standing, and graduation calculations.
5. Academic audit event: immutable history of grading, posting, transcript, standing, promotion, and graduation changes.

Course evaluation does not automatically become an official transcript entry. Official posting happens through a transcript/progress/completion posting rule, usually under registrar or academic administrator authority.

## Domain Model

### GradingProfile

Purpose: tenant-level grading and official-record policy derived from institution operating rules.

Fields:

- `tenantId`
- `defaultEvaluationType`
- `defaultOfficialRecordType`
- `supportsGpa`
- `supportsCredits`
- `supportsClockHours`
- `supportsCompetencies`
- `supportsNarrativeEvaluation`
- `supportsPromotion`
- `supportsGraduationAudit`
- `gradeReleasePolicy`
- `guardianVisibilityPolicy`
- `createdAt`
- `updatedAt`

Rules:

- `tenantId` must match the institution profile tenant.
- GPA support must align with institution operating rules.
- Guardian visibility policy is required when guardians are enabled.
- Transcript support requires at least one transcript or official-record posting rule.
- Children's school mode must support progress or narrative records.
- Bible school mode may support completion records without GPA.

### EvaluationScale

Purpose: reusable grade scale or non-grade evaluation scale.

Fields:

- `id`
- `tenantId`
- `name`
- `scaleType`
- `appliesToRecordType`
- `status`
- `createdAt`
- `updatedAt`

Scale types:

- `letter_grade`
- `numeric_percentage`
- `pass_fail`
- `completion`
- `competency`
- `narrative`
- `attendance_only`
- `custom`

Rules:

- Every scale belongs to one tenant.
- GPA-bearing scales must define grade points.
- Pass/fail and completion scales must define pass/completion thresholds.
- Narrative scales must define whether narrative text is required.
- Attendance-only scales must not generate GPA or transcript grade points.

### EvaluationScaleBand

Purpose: map raw evaluation outcomes to labels, points, pass status, and official-record values.

Fields:

- `id`
- `tenantId`
- `scaleId`
- `label`
- `minimumValue`
- `maximumValue`
- `gradePoints`
- `isPassing`
- `isCompletion`
- `officialRecordValue`
- `sequence`

Rules:

- Numeric bands cannot overlap inside a scale.
- GPA-bearing bands require grade points.
- Non-GPA bands must not contribute grade points.
- Official-record values must be deterministic.

### EvaluationRuleSet

Purpose: define how a course or section evaluates students.

Fields:

- `id`
- `tenantId`
- `courseId`
- `sectionId`
- `evaluationType`
- `scaleId`
- `recordType`
- `gpaPolicy`
- `creditPolicy`
- `clockHourPolicy`
- `competencyPolicy`
- `narrativePolicy`
- `postingPolicy`
- `lmsGradeReturnPolicy`
- `status`
- `createdAt`
- `updatedAt`

Rules:

- Rule sets may be course-level defaults or section-level overrides.
- A rule set must reference a scale compatible with its evaluation type.
- GPA policy cannot be enabled for non-GPA institutions.
- Credit policy requires credit-bearing course duration.
- Clock-hour policy requires clock-hour support.
- Competency policy requires competency support.
- Narrative policy requires narrative support.
- LMS grade return policy is provider-neutral and does not store provider credentials.

### EvaluationResult

Purpose: student-specific submitted or draft evaluation outcome.

Fields:

- `id`
- `tenantId`
- `studentPersonId`
- `sectionId`
- `ruleSetId`
- `evaluatorPersonId`
- `sourceType`
- `rawValue`
- `scaleBandId`
- `narrative`
- `competencyResults`
- `attendanceValue`
- `status`
- `submittedAt`
- `createdAt`
- `updatedAt`

Source types:

- `manual_entry`
- `lms_grade_return`
- `bulk_import`
- `system_calculation`

Status values:

- `draft`
- `submitted`
- `returned_for_revision`
- `approved_for_posting`
- `voided`

Rules:

- Evaluation results are tenant-scoped.
- A result must reference an active student profile and section.
- Evaluator must have an active instructional, professor, faculty, academic admin, dean, or registrar role scoped to the section or tenant.
- LMS grade return may create submitted results but cannot create official records directly.
- Narratives are required when the rule set requires narrative text.
- Competency results must match the rule set competency policy.

### OfficialRecordRule

Purpose: define what can be posted to official records.

Fields:

- `id`
- `tenantId`
- `recordType`
- `appliesToInstitutionMode`
- `postingAuthority`
- `releasePolicy`
- `includedInTranscript`
- `includedInProgressReport`
- `includedInCompletionRecord`
- `includedInPromotion`
- `includedInGraduationAudit`
- `status`

Record types:

- `transcript`
- `progress_record`
- `completion_record`
- `report_card`
- `competency_record`
- `attendance_record`
- `graduation_audit`
- `custom`

Rules:

- Posting rules must align with institution operating rules and course record type.
- Registrar posting is required for transcript-bearing official records.
- Guardian release policy is required for minor-visible records.
- Completion records may be official without GPA.

### OfficialRecordEntry

Purpose: registrar-posted academic record used for transcripts, progress reports, completion records, promotion, standing, and graduation audit.

Fields:

- `id`
- `tenantId`
- `studentPersonId`
- `evaluationResultId`
- `recordRuleId`
- `courseId`
- `sectionId`
- `academicYearId`
- `academicPeriodId`
- `recordType`
- `recordValue`
- `gradePoints`
- `creditsAttempted`
- `creditsEarned`
- `clockHoursAttempted`
- `clockHoursEarned`
- `narrative`
- `competencySummary`
- `postedByPersonId`
- `postedAt`
- `status`
- `createdAt`
- `updatedAt`

Status values:

- `posted`
- `superseded`
- `voided`
- `held`

Rules:

- Posted entries are immutable except through superseding or voiding events.
- Transcript entries require academic period and course references.
- Progress records may use narrative and competency summaries.
- Completion records may use completion value and clock hours without GPA.
- Held records are not released to students, guardians, or transcript outputs.

### AcademicStandingRule

Purpose: define probation, warning, good standing, promotion, retention, or graduation readiness thresholds.

Fields:

- `id`
- `tenantId`
- `name`
- `standingType`
- `appliesToInstitutionMode`
- `minimumGpa`
- `minimumCreditsEarned`
- `minimumClockHours`
- `requiredCompetencies`
- `requiredCompletionRecords`
- `promotionCriteria`
- `graduationCriteria`
- `status`

Standing types:

- `good_standing`
- `warning`
- `probation`
- `retention_review`
- `promotion_ready`
- `graduation_ready`
- `graduation_blocked`

Rules:

- GPA thresholds require GPA support.
- Children's promotion rules may use narrative, competency, attendance, and grade-band criteria.
- Bible school completion rules may use clock-hour, completion, practicum, or competency criteria.
- Graduation rules may combine credits, GPA, holds, required records, and program completion.

### AcademicRecordAuditEvent

Purpose: immutable audit history for grading and official-record changes.

Fields:

- `id`
- `tenantId`
- `entityType`
- `entityId`
- `studentPersonId`
- `actorPersonId`
- `action`
- `reason`
- `beforeSnapshot`
- `afterSnapshot`
- `createdAt`

Rules:

- Every official record post, hold, release, supersede, void, and grade-change action creates an audit event.
- Audit events are tenant-scoped and immutable.
- Audit snapshots must not store LMS credentials or provider tokens.
- Audit output must be role-restricted.

## Validation Rules

Tenant and references:

- Every grading, evaluation, record, standing, and audit item must match the institution tenant.
- Referenced courses, sections, periods, students, staff, and people must exist in the same tenant.
- Official record entries must reference compatible evaluation results and posting rules.

Institution mode:

- Children's school mode must support progress, report card, competency, or narrative records before it can expose guardian-visible academic records.
- Bible school mode must support completion, pass/fail, competency, clock-hour, or certificate records without requiring GPA.
- Seminary, college, and university transcript modes must define transcript posting rules and at least one transcript-compatible scale.
- Mixed institutions must define mode-scoped record rules or safe defaults that do not force every branch into GPA.

Scale and evaluation:

- GPA-bearing scales require grade points.
- Non-GPA evaluation types must not affect GPA.
- Numeric bands cannot overlap.
- Pass/fail and completion rules must define pass/completion status.
- Narrative-required rule sets must reject empty narratives.
- Competency rule sets must require compatible competency result structures.

Posting and release:

- Official transcript posting requires registrar, dean, academic admin, or institution admin authority.
- Instructor/faculty submissions do not become official without posting.
- Grade changes after posting require a superseding record and audit event.
- Guardian visibility must respect relationship visibility and grade-release policy.
- Held records must not appear in student/guardian read models or transcript outputs.

LMS:

- LMS grade return can only create or update evaluation results.
- LMS grade return cannot directly post official records.
- Provider-specific grade payloads must be normalized before entering the grading domain.
- No provider credentials, tokens, or LMS passwords are stored in grading records.

ShepherdAI:

- Allowed future signals include missing rule sets, unposted submitted results, transcript holds, grade windows closing, credit/GPA pace gaps, promotion criteria gaps, and graduation blockers.
- Forbidden signals include spiritual condition, counseling notes, giving history, devotional participation, raw LMS engagement, or pastoral care records.
- Recommendations must explain deterministic Academy-owned record gaps, not infer student character or faithfulness.

## Security And Privacy

Grade and transcript data must be treated as high-sensitivity academic records.

Required future controls:

- tenant-scoped reads and writes
- role-scoped grade entry and official posting
- relationship-scoped guardian visibility
- student self-access only to released records
- registrar/dean/admin control over official transcript posting and grade changes
- immutable audit history for grade and record mutations
- explicit release/hold flags
- no provider secrets in grading, transcript, audit, or LMS return records

## Future Implementation Sequence

1. Phase 5 Sprint 2: grading type, scale, rule-set, official-record, standing, and audit TypeScript types with validation tests.
2. Phase 5 Sprint 3: deterministic transcript and official-record evaluator.
3. Phase 5 Sprint 4: academic standing, promotion, and graduation evaluator.
4. Phase 5 Sprint 5: grading and transcript review UI.
5. Later persistence/API slices if the factory splits Phase 5 further for safety.
6. Later LMS contract/provider slices for grade return after the provider-neutral contract exists.
7. Later Student PWA slices for released grade, progress, transcript, and guardian-visible record surfaces.

## Review Checklist

- The model supports children, Bible school, seminary, college, university, and mixed institutions.
- Official records are separate from draft/submitted evaluations.
- GPA is optional and mode-scoped.
- Narrative, competency, completion, and attendance records are first-class.
- Transcript posting is registrar-controlled and audited.
- Guardian visibility is release-policy and relationship scoped.
- LMS grade return is provider-neutral and non-authoritative until reviewed.
- ShepherdAI uses only Academy-owned deterministic record gaps.
- No runtime behavior is introduced by this sprint.
