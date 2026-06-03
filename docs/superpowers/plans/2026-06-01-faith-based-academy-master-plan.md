# Faith-Based Academy Implementation Plan

> **For agentic workers:** This is a tool-agnostic software-factory plan. Codex, GitHub Copilot, Claude Code, and similar tools can execute it by using focused passes, subagents where available, or separate task sessions. When Codex has Superpowers skills available, Codex must use the relevant Superpowers skills while executing this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition and build ChurchCore Academy as a configurable faith-based education management system and SIS for Bible schools, children's schools, seminaries, colleges, and universities.

**Architecture:** Academy remains the system of record and owns institution, academic, student, grading, transcript, workflow, and student PWA domains. LMS providers integrate through a provider-neutral contract with no-LMS, Moodle, and Canvas adapters.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase/Postgres, Vercel, node:test, ESLint.

---

## Factory Review Status

- Context layer: pass; repo docs, product scope, LMS boundary, and current implementation were inspected.
- Knowledge layer: pass; master plan, platform design spec, implementation plan, LMS strategy, architecture docs, and software factory are linked.
- Agent layer: pass; subplans map to focused product, data, backend, frontend/PWA, LMS, ShepherdAI, test, and security roles.
- Workflow layer: partial pass; this is a portfolio-level implementation plan. Each subplan must produce a detailed task-level execution plan before code starts.
- Delivery layer: pass; global verification commands are listed, and subplans now require relevant domain-specific checks.

## Execution Rule

Do not implement an entire subplan directly from this master plan. Before code changes for any subplan, create a detailed execution package with:

- factory intake
- discovery notes
- chosen design approach
- files to create or modify
- migration and seed strategy if data changes exist
- test plan with exact commands
- security and privacy review points
- delivery checklist

## File Structure

- `README.md`: public repo positioning, scope, and next steps.
- `CLAUDE.md`: authoritative agent rules and product boundary.
- `docs/product/faith-based-academy-master-plan.md`: product master plan.
- `docs/product/factory-roadmap.md`: one-week sprint phase roadmap and reviewable boundaries.
- `docs/software-factory.md`: AI-assisted development factory definition and delivery workflow.
- `docs/adr/README.md`: architecture decision procedure.
- `docs/reviews/reviewer-procedure.md`: reviewer procedure and PR checklist.
- `docs/agents/product-opportunity-scout.md`: idea-generation agent definition.
- `docs/architecture.md`: repository and LMS boundary.
- `docs/architecture/churchcore-academy-boundary.md`: concise product boundary.
- `docs/shepherd-ai-academy.md`: ShepherdAI constraints and expansion direction.
- `docs/lms-dual-provider-strategy.md`: LMS provider decision and integration model.
- `src/modules/academy-config/*`: future institution configuration domain.
- `src/modules/academic-calendar/*`: future academic year and term domain.
- `src/modules/course-catalog/*`: future course, section, and course duration domain.
- `src/modules/grading/*`: future grading, transcript, standing, and promotion rules.
- `src/modules/people/*`: future students, guardians, faculty, teachers, professors, and administrators.
- `src/modules/lms-integrations/*`: future provider-neutral LMS contract and adapters.
- `src/app/student/*`: future student PWA routes.

## Subplan 1: Product Identity And Boundary

- [x] Update repo docs to describe Academy as a faith-based education management system and SIS.
- [x] Replace college-only language with Bible school, children's school, seminary, college, and university support.
- [x] Keep LMS runtime code explicitly out of this repository.
- [x] Define the ChurchCore Academy software factory in `docs/software-factory.md`.
- [x] Define one-week sprint phases and reviewable boundaries in `docs/product/factory-roadmap.md`.
- [x] Define ADR procedure in `docs/adr/README.md`.
- [x] Record ADR 0001 for one-week factory sprints.
- [x] Define reviewer procedure in `docs/reviews/reviewer-procedure.md`.
- [x] Define Product Opportunity Scout in `docs/agents/product-opportunity-scout.md`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

## Subplan 2: Institution Configuration

- [x] Create Phase 1 Sprint 1 institution type and operating rules design package.
- [x] Record ADR 0002 for the institution type and operating rules model.
- [x] Create Phase 1 Sprint 2 execution package for institution configuration types, defaults, and validation.
- [x] Create types for institution type and operating rules.
- [x] Add default institution profiles for Bible school, children's school, seminary, college, university, and mixed institution modes.
- [x] Add validation tests for institution mode, guardian, LMS, and transcript rule combinations.
- [x] Create detailed execution package for the migration and seed data sprint.
- [x] Add Postgres table for tenant-scoped institution profile storage.
- [x] Add seeded mock institution profile data.
- [x] Update local migration runner to apply all migrations in order.
- [x] Update Academy dataset load and seed paths for institution profiles.
- [x] Add institution configuration repository and API read path.
- [x] Add tenant-scoped repository tests and API payload tests.
- [ ] Create types for campus, department, division, grade band, school, and cohort.
- [ ] Add Postgres tables and seed data for campus, department, division, grade band, school, and cohort.
- [ ] Add repository methods for loading tenant configuration.
- [ ] Add tests for Bible school, children's school, seminary, college, and university configuration.
- [x] Add admin UI entry points for reviewing configuration.
- [x] Add security review for tenant isolation and institution-level administration permissions.

## Subplan 3: Academic Calendar

- [x] Create detailed execution package for this subplan.
- [x] Create academic year, term, session, module, enrollment window, grading window, and transcript period types.
- [x] Add validation rules for overlapping dates and active academic periods.
- [x] Add Postgres persistence and seed data.
- [x] Add repository read path for tenant academic calendar configuration.
- [x] Add API read path for tenant academic calendar configuration.
- [x] Add tests for semester, quarter, trimester, module, and school-year calendars.
- [x] Add admin review UI for academic years, periods, windows, subdivisions, and validation status.
- [ ] Add editable UI for academic year and term management.
- [ ] Add audit trail for calendar changes that affect enrollment, grading, or transcript periods.

## Subplan 4: Course Catalog And Sections

- [x] Create detailed execution package for this subplan.
- [x] Create course type, duration type, credit, clock-hour, prerequisite, section, and delivery-mode models.
- [ ] Support teachers and professors as assignable instructional staff.
- [ ] Add section setup workflows for missing instructor, over-capacity roster, and missing syllabus/setup data.
- [x] Add Postgres persistence and seed data.
- [x] Add repository read path for tenant course catalog configuration.
- [x] Add API read path for tenant course catalog configuration.
- [x] Add tests for Bible course, general education course, ministry practicum, elective, and children's school class models.
- [x] Add provider-neutral LMS mapping fields without storing provider-specific runtime behavior in Academy domain logic.
- [x] Add admin review UI for course setup, sections, duration readiness, instructor readiness, and LMS mapping posture.

## Subplan 5: Grading And Transcript Rules

- [x] Create detailed execution package for this subplan.
- [x] Create grading scale, grade band, grade type, GPA rule, pass/fail rule, competency rule, narrative rule, transcript rule, promotion rule, and graduation rule models.
- [x] Add deterministic transcript and official-record evaluator.
- [x] Add deterministic academic standing, promotion, and graduation evaluators.
- [x] Add Postgres persistence and seed data.
- [x] Add grading configuration API read path.
- [x] Add tests for college GPA, pass/fail certificate, competency Bible school, narrative elementary, and seminary transcript configurations.
- [x] Add UI for grading model review.
- [x] Add security and audit review for grade, transcript, promotion, and graduation changes.

## Subplan 6: People And Roles

- [x] Create detailed execution package for this subplan.
- [x] Expand people types to support students, guardians, teachers, professors, faculty, advisors, registrar staff, admissions staff, deans, and institution administrators.
- [x] Add role-scoped permissions for Academy routes and APIs.
- [x] Add guardian relationship support for children's school mode.
- [x] Add guardian category access and contact-only privacy validation.
- [x] Add Postgres persistence and seed data.
- [x] Add repository read path for tenant people configuration.
- [x] Add admin review UI for people, roles, guardians, staff profiles, account links, and validation status.
- [x] Add tests for staff-only, faculty, student, and guardian access boundaries.
- [x] Add privacy review for guardian access to children's school records and student self-service records.

## Subplan 7: Student PWA

- [ ] Create detailed execution package for this subplan.
- [ ] Add student route group and PWA manifest.
- [ ] Add student dashboard for schedule, courses, grades, documents, messages, academic progress, and LMS launch.
- [ ] Add offline-friendly shell for critical student pages.
- [ ] Add tests for student-visible data boundaries.
- [ ] Add browser verification for desktop and mobile layouts.
- [ ] Add installability and offline behavior verification for supported PWA routes.

## Subplan 8: LMS Provider Contract

- [ ] Create detailed execution package for this subplan.
- [ ] Define provider-neutral interfaces for identity launch, logout, course shell provisioning, section mapping, roster sync, enrollment sync, grade return, progress return, webhooks, and reconciliation.
- [ ] Add no-LMS provider implementation.
- [ ] Add contract conformance tests.
- [ ] Add tenant-level provider selection.
- [ ] Add audit logs for all provider sync operations.
- [ ] Add failure-mode tests for retries, idempotency, duplicate events, and provider downtime.

## Subplan 9: Moodle Adapter

- [ ] Create detailed execution package for this subplan.
- [ ] Implement Moodle provider using Moodle External Services.
- [ ] Map Academy users, courses, sections, roles, enrollments, and grade return to the provider contract.
- [ ] Add retry and reconciliation behavior.
- [ ] Add contract conformance tests against mocked Moodle responses.
- [ ] Document required Moodle configuration.
- [ ] Add trademark and deployment notes for institutions offering Moodle-related services.

## Subplan 10: Canvas Adapter

- [ ] Create detailed execution package for this subplan.
- [ ] Implement Canvas provider using the Canvas REST API.
- [ ] Map Academy users, courses, sections, roles, enrollments, and grade return to the provider contract.
- [ ] Add provider capability matrix for Canvas-specific differences.
- [ ] Add contract conformance tests against mocked Canvas responses.
- [ ] Document required Canvas developer key and OAuth configuration.
- [ ] Add OAuth, token storage, and provider-rate-limit review.

## Subplan 11: ShepherdAI Academy Alignment

- [ ] Create detailed execution package for this subplan.
- [ ] Expand allowed Academy-only signal types after institution, calendar, course, grading, and transcript models exist.
- [ ] Add recommendations for configuration gaps, unassigned teachers, grading inconsistencies, transcript readiness, and student action reminders.
- [ ] Keep all recommendations deterministic, explainable, and human-reviewed.
- [ ] Add tests that reject LMS engagement, spiritual-condition, counseling, giving, and devotional signals.
- [ ] Update UI wording to reflect faith-based education management without implying cross-product intelligence.
- [ ] Add explainability review for every new signal category.

## Verification

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Start `npm run dev` and verify dashboard, workflows, student page, program page, and faculty page.
- [ ] Verify no Moodle or Canvas runtime code exists in this repository.

## Factory Review Checklist

Use this checklist before marking any subplan complete:

- [ ] Product area is identified.
- [ ] Institution modes affected are identified.
- [ ] Student, guardian, grade, transcript, and LMS sync risks are identified.
- [ ] Academy/LMS boundary is preserved.
- [ ] Tenant isolation is addressed.
- [ ] Auth and role access are addressed.
- [ ] Tests cover deterministic domain behavior.
- [ ] UI/PWA work has browser verification evidence.
- [ ] Provider work has contract conformance tests.
- [ ] ShepherdAI work rejects forbidden signal sources.
- [ ] `npm test`, `npm run lint`, and `npm run build` pass.
