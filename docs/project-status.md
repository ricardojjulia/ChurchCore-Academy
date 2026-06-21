# Project Status

- Version: `0.1.0`
- Stage: active pre-production development
- Updated: 2026-06-21

## Current Assessment

ChurchCore Academy has completed the major ADR-0033 pre-production SIS workflow slices and the ADR-0038 acceptance/deployment readiness package. Council Review IX approves a split decision: ship a controlled pilot for core SIS workflows with provider activation disabled, and defer live providers, regulated aid, broad production official-record use, and general availability.

Council Review IX rates controlled-pilot MVP readiness at **86/100**, competitive readiness at **78/100**, and production/GA readiness at **62/100**.

## Implemented and Verified

- configurable institution, calendar, subdivision, course, people, and grading foundations
- verified-session Academy identity
- persisted account links and active role assignments
- request-scoped PostgreSQL tenant context
- forced RLS and tenant-aware foreign keys
- immutable audit evidence
- admissions application through decision
- accepted-application conversion into student, enrollment, and period registration
- admissions staff workflow visibility from converted application to created student record
- working MVP surface pass for student/program indexes and dashboard navigation to core staff/admin workflows
- Gradebook Phase 1 schema, RLS, override audit, GrowthFrameFilter, route scaffolds, tenant-scoped read models, and faculty grade-entry queue
- Student PWA shell and provider-neutral LMS launch
- Student PWA workflow surfaces for courses, schedule, progress, documents/transcript request, account, aid, messages, LMS launch, attendance, and privacy controls
- no-LMS provider, Moodle/Canvas contract foundations, and executable LMS worker boundary
- deterministic ShepherdAI workflow suggestions
- LLIS learner consent lifecycle and immutable evidence ledger
- Release 1 authentication, tenant isolation, RLS, and seeded-runtime-data exit gate closeout
- Council Review VII Full SIS Competitive MVP release program, change-management record, and AI prompt pack
- Council Review VIII post-Slice-9 assessment, ADR-0038 deployment-readiness decision, change-management addendum, and acceptance/deployment prompt pack
- ADR-0038 Prompt 1 role-matrix acceptance checklist with executable route/API inventory and finance role mapping
- ADR-0038 Prompt 2 migration, seed, and rehearsal verifier package
- ADR-0038 Prompt 3 deployment operations, incident response, and backup/restore runbooks
- ADR-0038 Prompt 4 provider activation checklist for payments, communications, Moodle, Canvas, and regulated aid
- Council Review IX split release decision and controlled-pilot release notes
- authenticated role walkthrough harness, seeded acceptance personas, and generated evidence template
- reporting dashboard and CSV export foundation for core SIS domains
- persisted communications queue, provider-safe email boundary, and admin/student/guardian message centers

## Partially Implemented

- Gradebook bulk operations and full faculty grading workflow polish
- live Moodle and Canvas HTTP clients beyond normalized executable worker boundaries
- per-tenant authenticated browser role-matrix screenshots and console-error capture during pilot onboarding
- complete production observability instrumentation and provider-specific operations activation

## Production MVP Blockers

- certified ATS/IPEDS compliance reporting
- live email/SMS provider workers and communications delivery automation
- live payment-provider checkout and settlement automation
- regulated/federal financial-aid activation and compliance validation
- live Moodle/Canvas provider-client activation and tenant credentials
- competitive acceptance/onboarding role-matrix verification across all primary workflows
  - Status: baseline role-matrix inventory, seeded personas, and generated walkthrough template are complete; per-tenant screenshot and console-error evidence remains required.

## Product Safety Position

- Academy is approved only for controlled-pilot core SIS use under the Council Review IX split decision.
- Academy is not approved for general availability or unrestricted production official records.
- Model-generated learner predictions are not approved.
- Autonomous academic or pastoral interventions are not approved.
- Federal-aid functionality requires separate regulatory validation and activation gates.

The canonical sequence is maintained in the [Factory Roadmap](product/factory-roadmap.md).
The full SIS competitive release program is recorded in [ADR-0033](adr/0033-full-sis-competitive-mvp-release-program.md).
The current release decision is recorded in [Council Review IX](reviews/2026-06-21-council-review-9-release-closeout.md) and [Controlled Pilot Release Notes](releases/2026-06-21-controlled-pilot-release-notes.md).
