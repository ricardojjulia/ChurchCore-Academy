# Full SIS MVP Factory AI Coding Prompts

Use these prompts one at a time. Do not combine slices. Each prompt requires the ChurchCore Academy software factory in `docs/software-factory.md`.

## Global Execution Contract For Every Prompt

Before coding:

1. Read `docs/software-factory.md`.
2. Read `docs/reviews/2026-06-21-council-review-7-full-sis-mvp-competitiveness.md`.
3. Read `docs/adr/0033-full-sis-competitive-mvp-release-program.md`.
4. Inspect the current code and tests for the named product area.
5. Create or update the slice spec under `docs/superpowers/specs/`.
6. Create or update the slice plan under `docs/superpowers/plans/`.
7. Use TDD for domain, repository, service, route, and policy behavior.
8. Update docs, runbooks, project status, and roadmap when behavior changes.
9. Verify with `npm test`, `npm run lint`, `npm run build`, plus scope-specific checks.
10. Commit only the slice scope.

## Prompt 1 — Course Registration And Enrollment Confirmation

You are implementing the first Full SIS Competitive MVP slice for ChurchCore Academy.

Goal: make course-section registration and enrollment confirmation transactional end-to-end.

Factory requirements:

- Use `docs/software-factory.md`.
- Create `docs/superpowers/specs/YYYY-MM-DD-course-registration-enrollment-confirmation-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-course-registration-enrollment-confirmation.md`.
- If durable policy or persistence decisions change, create an ADR.

Scope:

- Inspect `src/modules/course-registration`, `src/app/api/academy/registrations`, admissions conversion, enrollment conversion, academic calendar, course catalog, and Student PWA read models.
- Implement registration eligibility: active enrollment, academic period, section capacity, enrollment window, prerequisites when available, hold blocks when available, and role permissions.
- Implement enrollment confirmation: accepted/converted student can be confirmed into section registrations; admin/registrar can override with audit reason.
- Add immutable audit events for registration create, drop, waitlist, confirm, and override.
- Add admin UI for reviewing registrations and student UI for seeing confirmed schedule.
- Do not implement billing or LMS provisioning in this slice; emit state/events that later slices can consume.

Verification:

- Domain tests for eligibility and state transitions.
- Repository tests for tenant predicates and idempotency.
- Route tests for auth, role, validation, and safe errors.
- Browser verification for admin and student flows.
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 2 — Attendance And Production Grade Posting

You are implementing the second Full SIS Competitive MVP slice.

Goal: make attendance and grade posting production workflows, not just surfaces.

Factory requirements:

- Use `docs/software-factory.md`.
- Create `docs/superpowers/specs/YYYY-MM-DD-attendance-grade-posting-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-attendance-grade-posting.md`.
- Update ADRs if official-record posting rules change.

Scope:

- Inspect `src/modules/attendance`, `src/modules/gradebook`, faculty routes, admin routes, and grading records.
- Implement faculty attendance capture per section meeting/session.
- Implement grade submission and registrar/admin posting boundary.
- Preserve GrowthFrameFilter and learner-safe grade display.
- Add override audit and role-scoped ownership checks.
- Add student release filtering so draft/unposted grades are not visible.

Verification:

- Tests for faculty ownership, cross-tenant denial, attendance capture, grade submission, posting, override, and student visibility.
- Browser verification for faculty grade/attendance entry and admin review.
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 3 — Transcript Request And Issuance

You are implementing the third Full SIS Competitive MVP slice.

Goal: make transcript request, issuance, hold, release, revoke, and export operational.

Factory requirements:

- Use `docs/software-factory.md`.
- Create `docs/superpowers/specs/YYYY-MM-DD-transcript-request-issuance-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-transcript-request-issuance.md`.
- Align with ADR-0011.

Scope:

- Inspect `src/modules/transcripts`, grading official records, admin transcripts route, student documents/progress routes, and transcript APIs.
- Implement student transcript request with delivery method.
- Implement registrar issuance from posted official records only.
- Implement holds, release, revoke, delivery status, and immutable audit events.
- Add print/export output suitable for MVP official transcript issuance.
- Add student request UI and admin issuance UI.

Verification:

- Tests for posted-only records, holds, release, revoke, role gates, audit immutability, and student/guardian visibility.
- Browser verification for student request and registrar issuance.
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 4 — Billing, Payments, And Student Accounts

You are implementing the fourth Full SIS Competitive MVP slice.

Goal: create a minimal but real student account ledger and payment workflow.

Factory requirements:

- Use `docs/software-factory.md`.
- Create `docs/superpowers/specs/YYYY-MM-DD-billing-payments-student-accounts-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-billing-payments-student-accounts.md`.
- Create an ADR for ledger/payment provider boundary.

Scope:

- Add billing module, migrations, RLS, immutable ledger entries, charges, credits, payments, voids, refunds, and student balance read model.
- Add payment provider boundary without exposing provider secrets.
- Add admin finance UI and student account PWA surface.
- Do not implement financial aid in this slice beyond ledger compatibility.

Verification:

- Tests for ledger immutability, idempotent payment posting, provider payload safety, role gates, and student account visibility.
- Browser verification for admin charge/payment and student balance.
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 5 — Financial Aid Foundation

You are implementing the fifth Full SIS Competitive MVP slice.

Goal: build an institutional aid foundation with explicit compliance gates.

Factory requirements:

- Use `docs/software-factory.md`.
- Create `docs/superpowers/specs/YYYY-MM-DD-financial-aid-foundation-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-financial-aid-foundation.md`.
- Create an ADR for regulated aid activation boundaries.

Scope:

- Add aid packages, awards, statuses, disbursement schedule, aid holds, ledger integration, and student aid read model.
- Keep federal/Title IV aid disabled unless a separate compliance gate is approved.
- Add admin aid UI and student aid visibility.

Verification:

- Tests for package lifecycle, award changes, disbursement, ledger interaction, student visibility, role gates, and disabled regulated-aid paths.
- Browser verification for admin/student aid flows.
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 6 — Reporting And Exports

You are implementing the sixth Full SIS Competitive MVP slice.

Goal: make reporting and exports operational for administrators and accreditation workflows.

Factory requirements:

- Use `docs/software-factory.md`.
- Create `docs/superpowers/specs/YYYY-MM-DD-reporting-exports-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-reporting-exports.md`.

Scope:

- Add canonical report models for enrollment, admissions, attendance, grades, transcripts, billing, aid, retention, and program completion.
- Add CSV exports and role-gated report endpoints.
- Add admin reporting UI with filters and export actions.
- Include ATS/IPEDS-ready foundations without claiming final regulatory certification.

Verification:

- Snapshot tests for report rows and CSV output.
- Route tests for role gates and tenant filtering.
- Browser verification for reporting UI.
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 7 — Notifications And Communications

You are implementing the seventh Full SIS Competitive MVP slice.

Goal: build communications that complete workflows rather than passive pages.

Factory requirements:

- Use `docs/software-factory.md`.
- Create `docs/superpowers/specs/YYYY-MM-DD-notifications-communications-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-notifications-communications.md`.
- Create an ADR for notification provider and retention policy if needed.

Scope:

- Add templates, audience resolution, send queue, in-app notifications, email-provider boundary, audit, retries, and opt-out/consent checks.
- Trigger notifications from admissions, registration, transcript, billing, grade release, attendance concern, and workflow assignment events.
- Add student, guardian, and staff message centers.

Verification:

- Tests for template rendering, audience scoping, guardian visibility, provider-safe payloads, retries, and audit.
- Browser verification for message center and workflow-triggered notices.
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 8 — Student PWA Workflow Completion

You are implementing the eighth Full SIS Competitive MVP slice.

Goal: make the Student PWA a workflow surface, not only a read shell.

Factory requirements:

- Use `docs/software-factory.md`.
- Create `docs/superpowers/specs/YYYY-MM-DD-student-pwa-workflow-completion-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-student-pwa-workflow-completion.md`.
- Align with ADR-0012 and ADR-0013.

Scope:

- Complete student registration, schedule, transcript request, billing/account, aid visibility, messages, documents, progress, LMS launch, privacy, and consent paths.
- Use release-safe read models and explicit mutations.
- Keep sensitive dynamic data out of offline cache.

Verification:

- Tests for self-scope, guardian-scope, release filtering, offline policy, and provider-secret exclusion.
- Browser/PWA verification for all student routes.
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 9 — LMS Execution Workers

You are implementing the ninth Full SIS Competitive MVP slice.

Goal: convert LMS contracts into executable, audited provider workers.

Factory requirements:

- Use `docs/software-factory.md`.
- Create `docs/superpowers/specs/YYYY-MM-DD-lms-execution-workers-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-lms-execution-workers.md`.
- Keep Academy as system of record.

Scope:

- Implement active-provider workers for course shell provisioning, roster sync, grade/progress reviewed imports, reconciliation, retries, and idempotency.
- Preserve no-LMS safe unsupported behavior.
- Do not let LMS providers post official grades or transcripts directly.

Verification:

- Provider contract tests for Moodle, Canvas, and no-LMS.
- Reconciliation and retry tests.
- Secret-exclusion tests.
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 10 — Competitive Acceptance And Onboarding

You are implementing the tenth Full SIS Competitive MVP slice.

Goal: prove the system is ready for design-partner onboarding as a competitive SIS MVP.

Factory requirements:

- Use `docs/software-factory.md`.
- Create `docs/superpowers/specs/YYYY-MM-DD-competitive-acceptance-onboarding-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-competitive-acceptance-onboarding.md`.

Scope:

- Build final role-matrix acceptance for institution admin, registrar, faculty, student, guardian, admissions, finance, platform admin.
- Verify all core SIS workflows end-to-end in browser.
- Run migration/seed/live-tenant rehearsal.
- Update README, project status, roadmap, runbooks, release notes, and council closeout.
- Produce final competitive readiness report.

Verification:

- `npm test`
- `npm run lint`
- `npm run build`
- browser role-matrix evidence
- migration and seed replay evidence
- security/privacy review
- final council `ship` decision
