# Project Status

- Version: `0.8.0`
- Stage: controlled-pilot candidate
- Updated: 2026-06-26

## Current Assessment

ChurchCore Academy has completed the major pre-production SIS workflow slices, the ADR-0038 acceptance/deployment readiness package, and the ADR-0059 full Moodle/Canvas LMS implementation closeout.

Council Review IX approved a split release decision for controlled-pilot core SIS workflows with provider activation disabled unless separately approved. Council Review XII closed the Academy-owned Moodle and Canvas implementation work while preserving the external sandbox-evidence gate for production LMS activation.

Current posture:

| Area | Status |
| --- | --- |
| Controlled-pilot core SIS readiness | Candidate |
| Competitive readiness | Strong pre-GA candidate |
| Production/GA readiness | Not approved |
| Live provider activation | External release gate |
| Regulated/federal aid | External compliance gate |

## Implemented And Verified

- Configurable institution, calendar, subdivision, course, people, guardian, faculty, grading, and transcript-rule foundations.
- Verified Supabase session identity.
- Persisted Academy account links and active role assignments.
- Request-scoped PostgreSQL tenant/person context.
- Forced RLS and tenant-aware foreign keys.
- Immutable audit evidence.
- Admissions application, submission, document checklist, review, decision, and conversion workflows.
- Accepted-application conversion into student, enrollment, and period registration records.
- Course-section registration and enrollment confirmation.
- Attendance and grade posting foundations.
- Transcript request, issuance, hold, release, revoke, PDF/export filtering, and storage boundary.
- Billing ledger, manual payment/account workflows, payment-plan foundation, and Stripe-hosted checkout boundary.
- Institutional financial-aid foundation with regulated-aid gate.
- Reporting dashboard, CSV export foundation, IPEDS review-required export foundation, and scheduled-report schema.
- Persisted communications queue, provider-safe email boundary, and admin/student/guardian message centers.
- Student PWA shell and workflow surfaces for courses, schedule, progress, documents/transcript request, account, aid, messages, LMS launch, attendance, offline shell, and privacy controls.
- Faculty portal surfaces for sections, schedule, roster, attendance, gradebook, and ShepherdAI work.
- Guardian portal shell with scoped student access.
- Platform tenant control plane.
- No-LMS, Moodle, and Canvas provider-neutral LMS contract foundations.
- Moodle and Canvas provider activation boundary, live transport helpers, durable worker, Student PWA launch parity, reviewed-import parity, reconciliation parity, and readiness surface.
- Deterministic ShepherdAI workflow suggestions and review lifecycle.
- LLIS learner consent lifecycle and immutable evidence ledger.
- Release 1 authentication, tenant isolation, RLS, and seeded-runtime-data exit gate closeout.
- ADR-0033 Full SIS Competitive MVP release program and change-management record.
- ADR-0038 acceptance/deployment readiness program, role matrix, migration/seed rehearsal verifier, deployment runbooks, incident response, backup/restore, provider activation checklist, and Council Review IX closeout.
- Authenticated role walkthrough harness, seeded acceptance personas, and generated evidence template.
- Production observability foundation for authentication, authorization, workflow, migration, and LMS provider-worker failures.
- Council Review XII full LMS integration MVP closeout.
- README, HOWTO, CHANGELOG, and VERSIONING documentation refresh.

## External Release Gates

These are not open implementation tasks in the repository. They are live-environment, governance, compliance, or tenant-approval gates.

- Moodle sandbox or tenant test-instance evidence for credential validation, course shell sync, roster sync, Student PWA launch, reviewed grade/progress return, reconciliation, rollback, and secret redaction.
- Canvas sandbox or tenant test-instance evidence for OAuth/token refresh, course shell sync, roster sync, Student PWA launch, reviewed grade/progress return, SIS import guardrails, reconciliation, rollback, and secret redaction.
- Tenant owner approval and provider owner signoff before LMS production activation.
- Live payment checkout and settlement approval before production payment activation.
- Live email/SMS delivery evidence and approval before provider delivery activation.
- Deployment-specific log drains, dashboards, and alert routing before expanding beyond controlled pilot.
- Per-tenant authenticated browser walkthrough screenshots and console-error capture during pilot onboarding.
- Regulated/federal financial-aid compliance validation before activation.
- Separate Council approval before model-generated learner predictions or autonomous academic/pastoral interventions.

## Product Safety Position

- Academy is approved only for controlled-pilot core SIS use under the split release decision.
- Academy is not approved for general availability.
- Academy is not approved for unrestricted production official-record use.
- Provider activation requires provider-specific evidence and approval.
- Moodle and Canvas code implementation is closed, but production activation is not automatic.
- Model-generated learner predictions are not approved.
- Autonomous academic or pastoral interventions are not approved.
- Federal-aid functionality requires separate regulatory validation and activation gates.

## Canonical References

- [README](../README.md)
- [HOWTO](../HOWTO.md)
- [CHANGELOG](../CHANGELOG.md)
- [Versioning](../VERSIONING.md)
- [Factory Roadmap](product/factory-roadmap.md)
- [ADR-0033 Full SIS Competitive MVP Release Program](adr/0033-full-sis-competitive-mvp-release-program.md)
- [ADR-0038 Competitive Acceptance And Deployment Readiness](adr/0038-competitive-acceptance-and-deployment-readiness.md)
- [ADR-0059 Full Moodle And Canvas Live Integration](adr/0059-full-moodle-canvas-live-integration.md)
- [Council Review IX Release Closeout](reviews/2026-06-21-council-review-9-release-closeout.md)
- [Council Review XII LMS Closeout](reviews/2026-06-26-council-review-12-full-lms-integration-mvp.md)
- [Controlled Pilot Release Notes](releases/2026-06-21-controlled-pilot-release-notes.md)
- [Full LMS Integration Readiness](releases/2026-06-26-full-lms-integration-readiness.md)
