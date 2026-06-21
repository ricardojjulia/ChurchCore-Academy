# Full SIS Competitive MVP Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn ChurchCore Academy into a fully working competitive SIS by shipping complete, verified workflow slices instead of screen-only coverage.

**Architecture:** Each slice follows the software factory: intake, discovery, design spec, plan, implementation, verification, review, and delivery. Persistence stays tenant-scoped with RLS. Student/guardian records flow through release-safe read models.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Supabase Auth/Postgres/RLS, `pg`, Node test runner with `tsx`, ESLint 9, provider-neutral LMS contracts.

---

## File Structure

- `docs/reviews/2026-06-21-council-review-7-full-sis-mvp-competitiveness.md`: council verdict and unanimous decision.
- `docs/adr/0033-full-sis-competitive-mvp-release-program.md`: durable release-program architecture decision.
- `docs/change-management/2026-06-21-full-sis-mvp-change-management.md`: change-control rules and risk register.
- `docs/prompts/2026-06-21-full-sis-mvp-factory-prompts.md`: AI coding prompts for each required implementation slice.
- Future slice specs: `docs/superpowers/specs/YYYY-MM-DD-<slice>-design.md`.
- Future slice plans: `docs/superpowers/plans/YYYY-MM-DD-<slice>.md`.

## Task 1: Course Registration And Enrollment Confirmation

**Files:**
- Create spec: `docs/superpowers/specs/YYYY-MM-DD-course-registration-enrollment-confirmation-design.md`
- Create plan: `docs/superpowers/plans/YYYY-MM-DD-course-registration-enrollment-confirmation.md`
- Expected modules: `src/modules/course-registration/*`, `src/app/api/academy/registrations/*`, admin/student pages, migrations.

- [ ] Write the failing domain tests for registration eligibility, capacity, holds, prerequisites, enrollment windows, and idempotency.
- [ ] Implement the minimal policy/service/repository changes.
- [ ] Add or update API routes with `requireActor()` and request-scoped DB context.
- [ ] Add admin and student UI paths.
- [ ] Verify with `npm test`, `npm run lint`, `npm run build`, role-matrix checks, and browser flow.
- [ ] Update docs and commit the slice.

## Task 2: Attendance And Production Grade Posting

**Files:**
- Create spec: `docs/superpowers/specs/YYYY-MM-DD-attendance-grade-posting-design.md`
- Create plan: `docs/superpowers/plans/YYYY-MM-DD-attendance-grade-posting.md`
- Expected modules: `src/modules/attendance/*`, `src/modules/gradebook/*`, faculty/admin routes, migrations.

- [ ] Write failing tests for attendance session capture, faculty ownership, grade submission, registrar posting, overrides, and student release filtering.
- [ ] Implement attendance and grade posting state transitions.
- [ ] Add protected API mutations and audit events.
- [ ] Complete faculty/admin UI flows.
- [ ] Verify with test/lint/build, role matrix, browser checks, and audit inspection.
- [ ] Update docs and commit the slice.

## Task 3: Transcript Request And Issuance

**Files:**
- Create spec: `docs/superpowers/specs/YYYY-MM-DD-transcript-request-issuance-design.md`
- Create plan: `docs/superpowers/plans/YYYY-MM-DD-transcript-request-issuance.md`
- Expected modules: `src/modules/transcripts/*`, `src/app/api/academy/transcripts/*`, student/admin transcript routes.

- [x] Write failing tests for transcript request, hold, issuance, release, revoke, delivery methods, and audit immutability.
- [x] Implement registrar-controlled transcript state transitions.
- [x] Add student request and admin issuance UI.
- [x] Add export/print output that excludes held or unreleased records.
- [x] Verify with test/lint/build, role matrix, and browser checks.
- [x] Update transcript runbook and commit the slice.

Verification note: Slice 3 passed focused transcript tests, full `npm test`, `npm run lint`, `npm run build`, `npx tsc --noEmit`, local migration replay, and protected-route HTTP smoke. The in-app Browser `iab` target was unavailable in this Codex session, so visual browser smoke is deferred to PR review.

## Task 4: Billing, Payments, And Student Accounts

**Files:**
- Create spec: `docs/superpowers/specs/YYYY-MM-DD-billing-payments-student-accounts-design.md`
- Create plan: `docs/superpowers/plans/YYYY-MM-DD-billing-payments-student-accounts.md`
- Expected modules: `src/modules/billing/*`, payment provider boundary, admin/student account pages, migrations.

- [x] Write failing tests for ledger entries, charge assessment, payment intent creation, payment posting, void/refund, and student account visibility.
- [x] Implement append-only ledger and provider-safe payment boundary.
- [x] Add admin finance and student account UI.
- [x] Add audit events and safe error handling.
- [x] Verify with test/lint/build, payment-provider sandbox checks, role matrix, and browser checks.
- [x] Update billing runbook and commit the slice.

Verification note: Slice 4 passed focused billing tests, full `npm test`, `npm run lint`, `npm run build`, `npx tsc --noEmit`, local migration replay, and protected-route HTTP smoke. The slice uses an MVP manual payment provider boundary; live payment-provider sandbox checkout is deferred because no card-data handoff or Stripe integration ships in this slice. The in-app Browser `iab` target was unavailable in this Codex session, so visual browser smoke is deferred to PR review.

## Task 5: Financial Aid Foundation

**Files:**
- Create spec: `docs/superpowers/specs/YYYY-MM-DD-financial-aid-foundation-design.md`
- Create plan: `docs/superpowers/plans/YYYY-MM-DD-financial-aid-foundation.md`
- Expected modules: `src/modules/financial-aid/*`, aid admin pages, migrations.

- [x] Write failing tests for institutional aid packages, award status, disbursement scheduling, aid holds, and ledger integration.
- [x] Implement non-federal aid foundation first.
- [x] Add explicit activation gates for regulated/federal aid.
- [x] Add admin UI and student aid read model.
- [x] Verify with test/lint/build, role matrix, privacy review, and browser checks.
- [x] Update aid compliance notes and commit the slice.

Verification note: Slice 5 passed focused financial-aid tests, Student PWA shell config test, full `npm test`, `npm run lint`, `npm run build`, `npx tsc --noEmit`, local migration replay, and protected-route HTTP smoke for `/admin/financial-aid`, `/student/aid`, and `/api/academy/financial-aid`. Federal and Title IV aid remain disabled by ADR-0036. The in-app Browser `iab` target was unavailable in this Codex session, so visual browser smoke is deferred to PR review.

## Task 6: Reporting And Exports

**Files:**
- Create spec: `docs/superpowers/specs/YYYY-MM-DD-reporting-exports-design.md`
- Create plan: `docs/superpowers/plans/YYYY-MM-DD-reporting-exports.md`
- Expected modules: `src/modules/reporting/*`, `src/app/admin/reporting/*`, export APIs.

- [x] Write failing tests for enrollment, attendance, grades, admissions, billing, aid, and transcript report models.
- [x] Implement canonical reporting queries with tenant predicates.
- [x] Add CSV/export endpoints with role gates.
- [x] Add admin reporting UI with filters and download actions.
- [x] Verify with test/lint/build, role matrix, and export snapshots.
- [x] Update reporting runbook and commit the slice.

Verification note: Slice 6 passed focused reporting tests, `npx tsc --noEmit`, full `npm test`, `npm run lint`, `npm run build`, local reporting repository smoke against `cca-main`, and protected-route HTTP smoke for `/admin/reporting` and `/api/academy/reports?report=enrollment&format=csv`. The in-app Browser `iab` target remained unavailable in this Codex session, so visual browser smoke is deferred to PR review.

## Task 7: Notifications And Communications

**Files:**
- Create spec: `docs/superpowers/specs/YYYY-MM-DD-notifications-communications-design.md`
- Create plan: `docs/superpowers/plans/YYYY-MM-DD-notifications-communications.md`
- Expected modules: `src/modules/communications/*`, templates, notification APIs, student/guardian/admin message routes.

- [ ] Write failing tests for templates, audience resolution, consent/guardian rules, send queue, retries, and audit.
- [ ] Implement in-app notification and email-provider boundary.
- [ ] Add workflow-triggered messages for admissions, registration, billing, transcripts, grade release, and workflow assignments.
- [ ] Add user-facing message centers.
- [ ] Verify with test/lint/build, browser checks, and provider-safe payload tests.
- [ ] Update communications runbook and commit the slice.

## Task 8: Student PWA Workflow Completion

**Files:**
- Create spec: `docs/superpowers/specs/YYYY-MM-DD-student-pwa-workflow-completion-design.md`
- Create plan: `docs/superpowers/plans/YYYY-MM-DD-student-pwa-workflow-completion.md`
- Expected modules: `src/modules/student-pwa/*`, student pages, service worker/offline policy.

- [ ] Write failing tests for registration, schedule, transcript request, billing view, messages, documents, progress, and privacy controls.
- [ ] Implement release-safe PWA read/write models.
- [ ] Complete student route actions and empty states.
- [ ] Verify no sensitive dynamic data is cached offline.
- [ ] Verify with test/lint/build and browser PWA checks.
- [ ] Update Student PWA docs and commit the slice.

## Task 9: LMS Execution Workers

**Files:**
- Create spec: `docs/superpowers/specs/YYYY-MM-DD-lms-execution-workers-design.md`
- Create plan: `docs/superpowers/plans/YYYY-MM-DD-lms-execution-workers.md`
- Expected modules: `src/modules/lms-contract/*`, worker scripts/routes, reconciliation tests.

- [ ] Write failing tests for course provisioning, roster sync, grade/progress reviewed imports, retries, idempotency, and reconciliation.
- [ ] Implement executable worker boundaries for active Moodle and Canvas tenants.
- [ ] Keep official records behind Academy review.
- [ ] Add operational runbook and failure recovery.
- [ ] Verify with provider contract tests, test/lint/build, and reconciliation evidence.
- [ ] Commit the slice.

## Task 10: Competitive Acceptance And Onboarding

**Files:**
- Create spec: `docs/superpowers/specs/YYYY-MM-DD-competitive-acceptance-onboarding-design.md`
- Create plan: `docs/superpowers/plans/YYYY-MM-DD-competitive-acceptance-onboarding.md`
- Expected docs: onboarding runbooks, release checklist, support procedures, competitive readiness report.

- [ ] Write acceptance checklist for all primary roles and workflows.
- [ ] Run browser role-matrix verification for admin, registrar, faculty, student, guardian, finance, admissions, and platform admin.
- [ ] Run migration/seed/live-tenant rehearsal.
- [ ] Update README, project status, roadmap, runbooks, and release notes.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and security/privacy review.
- [ ] Produce final council closeout and commit the release package.

## Self-Review

- This plan covers all Council VII blockers.
- No slice is screen-only.
- Every slice requires factory spec, plan, implementation, verification, review, and docs.
- Billing and aid are separated because they carry different compliance risk.
- Student PWA completion is placed after upstream workflows create release-safe data.
