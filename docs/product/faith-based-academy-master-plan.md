# ChurchCore Academy Faith-Based Education Master Plan

## Product Vision

ChurchCore Academy is a faith-based education management system and SIS for Bible schools, children's schools, seminaries, colleges, and universities.

The product should let each institution configure its academic structure without custom code: academic year, terms, sub-divisions, course types, course durations, grading models, teachers, professors, students, guardians, transcripts, student PWA workflows, and optional LMS provider integration.

Academy is the system of record. Moodle, Canvas, or another LMS can deliver course content, but LMS runtime behavior stays outside Academy domain logic.

## Factory Review Status

This master plan has been reviewed through the ChurchCore Academy software factory.

- Product boundary: pass
- Academy/LMS separation: pass
- Faith-based institution scope: pass
- Student, guardian, grading, transcript, and LMS data sensitivity: identified
- ShepherdAI guardrails: identified
- Execution readiness: portfolio-level pass; each roadmap item still requires a detailed factory implementation plan before code

The production MVP remediation design dated 2026-06-13 supersedes any interpretation that earlier prototype phases are production complete. Release 1 security work is implemented but still requires live RLS, browser-role, dependency, and runtime verification. The first admissions vertical slice now supports persistent draft, submission, and staff decision records with tenant constraints, RLS, idempotency, audit events, APIs, and a review page. Enrollment conversion, registration, attendance, grade entry, operational transcripts, billing, payments, financial aid, reporting, communications, persistent Student PWA workflows, and executable provider workers remain later release work.

## Core Product Principles

1. Faith-based by default, not generic with religious labels added later.
2. Configurable enough for a Bible institute, children's school, seminary, college, or university.
3. Academy owns student and institutional records.
4. LMS providers are optional adapters, not the core product.
5. ShepherdAI Academy remains deterministic, explainable, and human-reviewed.
6. Student PWA is a first-class surface, not an afterthought.

## Master Function Areas

### 1. Institution Configuration

Support institution type, campuses, departments, schools, divisions, grade levels, programs, cohorts, calendars, and operating rules.

### 2. Academic Calendar

Support academic years, terms, semesters, quarters, trimesters, sessions, modules, enrollment windows, grading windows, holidays, and transcript periods.

### 3. Course And Program Model

Support course catalogs, course types, duration types, credits, clock hours, prerequisites, sections, delivery modes, program requirements, electives, practica, internships, and ministry formation requirements when they are academic records.

### 4. Grading And Transcript Model

Support grading scales, grade bands, pass/fail, GPA, weighted GPA, competency grading, narrative evaluation, attendance-linked grading where applicable, transcript rules, promotion rules, graduation rules, and academic standing.

### 5. People And Roles

Support students, guardians, teachers, professors, faculty, advisors, registrar staff, admissions staff, academic administrators, deans, and institution administrators.

### 6. Student PWA

Support schedule, courses, grades, academic progress, registration, documents, messages, announcements, transcript requests, graduation readiness, and LMS launch.

### 7. LMS Provider Contract

Support Moodle first, Canvas second, and no-LMS mode. Integrations must use provider-neutral contracts for SSO, course shell provisioning, roster sync, enrollment sync, grade/progress return, and reconciliation.

### 8. ShepherdAI Academy

Support explainable academic workflow recommendations using only Academy-owned data. Recommendations remain suggestions for human review, never final academic decisions.

## Roadmap Order

1. Product identity and boundary docs.
2. Institution configuration foundation.
3. Academic calendar and sub-division model.
4. Course catalog, sections, and faculty/teacher assignment.
5. Grading, transcript, and academic standing.
6. Student PWA shell and student self-service.
7. LMS contract and no-LMS mode.
8. Moodle adapter.
9. Canvas adapter.
10. ShepherdAI expansion on top of the completed Academy data model.
11. Admissions and enrollment CRM.
12. Student billing and accounts.
13. Financial aid management.
14. Ministry formation and spiritual development records.
15. Competency-based and narrative evaluation expansion.
16. Cohort and modular enrollment management.
17. Compliance and accreditation reporting (ATS, IPEDS).
18. Faculty portal and qualification records.
19. Alumni, donor, and ministry placement CRM.
20. Denomination and church partner access model.
21. Certificate, CEU, and continuing education programs.
22. International student and multilingual support.
23. ShepherdAI academic early alert and advising intelligence.
24. ShepherdAI graduation readiness and enrollment pattern intelligence.

## Factory Work Packages

Each roadmap item must move through the software factory before implementation:

1. Intake: define users, institution modes, data touched, LMS impact, PWA impact, and privacy risk.
2. Discovery: inspect current code, docs, tests, and schemas.
3. Options: compare at least two approaches for new domain models or integration boundaries.
4. Design: update or create a spec under `docs/superpowers/specs/`.
5. Plan: create a detailed implementation plan under `docs/superpowers/plans/`.
6. Execution: make scoped, testable changes.
7. Verification: run tests, lint, build, and UI/browser checks where relevant.
8. Review: check product boundary, student data safety, auth, auditability, and LMS contract isolation.
9. Delivery: summarize changes, evidence, risks, and next work.

## LMS Decision

Use Moodle as the first LMS provider. Moodle is the best initial fit for faith-based schools because it is self-hostable, customizable, plugin-rich, and practical for smaller institutions that need ownership and branding flexibility.

Keep Canvas as a compatible second provider for institutions already invested in Canvas or needing a higher-ed-oriented LMS workflow.

Do not hardwire either provider into Academy. Let tenants choose Moodle, Canvas, or no LMS.

## Extended Domain Ownership

Based on competitive research (see `docs/product/sis-competitive-research-and-expansion-roadmap.md`), ChurchCore Academy also owns the following domains that are incomplete or not yet implemented:

- Admissions and enrollment CRM beyond the implemented application-to-decision slice
- Student billing, payment plans, and account management
- Financial aid packaging, FAFSA integration, and SAP tracking
- Ministry formation and spiritual development records (non-graded, distinct from transcript)
- Competency-based evaluation and narrative grading expansion
- Cohort and modular enrollment management (clock-hour Bible school model)
- ATS and IPEDS compliance reporting
- Faculty portal, teaching load, and credential qualification tracking
- Alumni and ministry placement tracking
- Donor and church partner relationship management
- Certificate programs, CEU tracking, and digital credential issuance
- International student enrollment and multilingual support
- ShepherdAI academic early alert, advising workflow intelligence, and graduation readiness

## Competitive Position

ChurchCore Academy targets the faith-based small and mid-size institution market where the primary competitor (Populi, starting at $199/month) serves well but has documented gaps:

- Plain UX not designed for theology school workflows
- No AI-powered advising or workflow recommendations
- No ministry formation records as first-class domain objects
- No competency-based learning support
- Limited mobile app
- No denomination/church partner integration
- Not natively ATS-compliant
- No faith-specific guardian portal for children's ministry schools

ChurchCore Academy's differentiators:

1. Built for theology school structures from day one
2. ShepherdAI workflow recommendations — no SIS competitor has this
3. Provider-neutral LMS contract (Moodle, Canvas, or no LMS)
4. First-class Student PWA
5. Faith formation as a distinct record domain
6. Guardian portal with scoped visibility for children's school populations
7. Competency and narrative grading native to the data model
8. ATS-native compliance reporting tooling
