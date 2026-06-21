# Project Status

- Version: `0.1.0`
- Stage: active pre-production development
- Updated: 2026-06-21

## Current Assessment

ChurchCore Academy has completed the major ADR-0033 pre-production SIS workflow slices. It should now be evaluated as a controlled-pilot candidate that still requires competitive acceptance, deployment readiness, provider activation, and final council closeout before production or general-availability claims.

Council Review VIII rates the current pre-production MVP readiness at **77/100** and competitive readiness at **68/100**.
The governing path for the next step is ADR-0038, the Competitive Acceptance And Deployment Readiness program.

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
- reporting dashboard and CSV export foundation for core SIS domains
- persisted communications queue, provider-safe email boundary, and admin/student/guardian message centers

## Partially Implemented

- Gradebook bulk operations and full faculty grading workflow polish
- live Moodle and Canvas HTTP clients beyond normalized executable worker boundaries
- browser role-matrix acceptance across later Release 2+ workflows
- complete production operations, observability, backup, and incident procedures

## Production MVP Blockers

- certified ATS/IPEDS compliance reporting
- live email/SMS provider workers and communications delivery automation
- live payment-provider checkout and settlement automation
- regulated/federal financial-aid activation and compliance validation
- live Moodle/Canvas provider-client activation and tenant credentials
- competitive acceptance/onboarding role-matrix verification across all primary workflows

## Product Safety Position

- Academy is not approved for production official records.
- Model-generated learner predictions are not approved.
- Autonomous academic or pastoral interventions are not approved.
- Federal-aid functionality requires separate regulatory validation and activation gates.

The canonical sequence is maintained in the [Factory Roadmap](product/factory-roadmap.md).
The full SIS competitive release program is recorded in [ADR-0033](adr/0033-full-sis-competitive-mvp-release-program.md).
The current acceptance and deployment readiness program is recorded in [ADR-0038](adr/0038-competitive-acceptance-and-deployment-readiness.md).
