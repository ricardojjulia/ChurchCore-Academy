# Project Status

- Version: `0.1.0`
- Stage: active pre-production development
- Updated: 2026-06-16

## Current Assessment

ChurchCore Academy has a substantial domain, security, and integration foundation. It should be evaluated as an emerging platform with several production-shaped vertical slices, not as a complete production SIS.

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
- no-LMS provider and Moodle/Canvas contract foundations
- deterministic ShepherdAI workflow suggestions
- LLIS learner consent lifecycle and immutable evidence ledger

## Partially Implemented

- Gradebook bulk operations and full faculty grading workflow polish
- Student PWA persistence across courses, schedule, progress, documents, and messages
- Moodle and Canvas execution beyond launch and contract/planning foundations
- browser role-matrix acceptance across all protected pages
- complete production operations, observability, backup, and incident procedures

## Production MVP Blockers

- course-section registration and enrollment confirmation
- attendance and production faculty grade entry workflows
- operational transcript issuance
- billing and payments
- institutional and regulated financial aid
- reporting and exports
- notifications and communications
- executable LMS synchronization workers
- complete Student PWA data workflows

## Product Safety Position

- Academy is not approved for production official records.
- Model-generated learner predictions are not approved.
- Autonomous academic or pastoral interventions are not approved.
- Federal-aid functionality requires separate regulatory validation and activation gates.

The canonical sequence is maintained in the [Factory Roadmap](product/factory-roadmap.md).
