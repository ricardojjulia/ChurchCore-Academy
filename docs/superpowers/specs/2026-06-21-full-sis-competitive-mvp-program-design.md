# Full SIS Competitive MVP Program Design

## Purpose

Define how ChurchCore Academy becomes a fully working, competitive SIS without sacrificing safety, auditability, or factory discipline.

## Current State

Implemented foundations:

- verified-session identity and request-scoped RLS;
- tenant-aware admissions decisioning and enrollment conversion;
- people, roles, calendar, course, grading, and program foundations;
- gradebook Phase 1 and faculty/admin routes;
- Student PWA read surfaces and LMS launch boundaries;
- provider-neutral LMS contracts for Moodle, Canvas, and no-LMS;
- ShepherdAI deterministic workflow suggestions.

Current blockers:

- applicant self-service and fee payment;
- course registration and enrollment confirmation;
- production attendance and grade posting;
- transcript request/issuance/hold/release workflows;
- billing, payments, student accounts, and financial aid;
- reporting, exports, and compliance;
- notifications and communications;
- complete Student PWA write workflows;
- executable LMS workers and acceptance testing.

## Design Principles

1. One slice equals one complete workflow.
2. Every workflow has a state machine or explicit transition policy.
3. Every persisted workflow is tenant-scoped and RLS-protected.
4. Official records are append/audit-first and recover through forward events.
5. Student and guardian surfaces read from release-safe read models only.
6. LMS providers are integration endpoints, never the system of record.
7. ShepherdAI recommends; humans decide.

## Release Slices

### Slice 1: Course Registration And Enrollment Confirmation

Build course-section registration from active enrollment through confirmed section registration, including capacity, enrollment window, prerequisite/hold checks, admin override, student-visible confirmation, and audit events.

### Slice 2: Attendance And Production Grade Posting

Build daily attendance capture, faculty grade submission, registrar/admin posting controls, override audit, and student release-state filtering.

### Slice 3: Transcript Request And Issuance

Build student transcript requests, registrar issuance, delivery method selection, hold/release/revoke state, immutable audit, and printable/exportable official output.

### Slice 4: Billing, Payments, And Student Accounts

Build ledger, charge assessment, payment intent/provider boundary, payment posting, refunds/voids, and student account PWA surface.

### Slice 5: Financial Aid Foundation

Build institutional aid packaging and compliance-safe foundation. Federal/regulated aid remains behind explicit activation gates.

### Slice 6: Reporting And Exports

Build canonical reporting models for enrollment, attendance, grades, transcripts, billing, aid, admissions, retention, and ATS/IPEDS-ready exports.

### Slice 7: Notifications And Communications

Build template-managed email/in-app notifications for admissions, registration, billing, transcript, grade release, attendance, and workflow assignments.

### Slice 8: Student PWA Workflow Completion

Complete student-side registration, transcript requests, billing view, messages, documents, schedule, progress, and privacy/consent workflows.

### Slice 9: LMS Execution Workers

Convert contract/planning outcomes into executable provider workers with idempotency, audit, retries, and reconciliation.

### Slice 10: Competitive Acceptance And Onboarding

Run full role-matrix browser verification, seeded/live tenant rehearsal, onboarding runbooks, support procedures, release notes, and competitive readiness review.

## Data And Privacy

- All workflow tables include `tenant_id`.
- Mutating workflows include idempotency keys where retries are plausible.
- Official academic, finance, aid, and transcript records write immutable audit events.
- Student/guardian read models must filter by relationship, release, hold, and consent state.
- Payment provider secrets and LMS provider secrets never enter browser payloads.

## Testing Strategy

- Domain tests for state transitions and policy decisions.
- Repository tests for tenant predicates and idempotency.
- Route tests for auth, role, validation, and safe errors.
- Migration tests for RLS and constraints.
- Browser tests for role-visible completion paths.
- Build/lint/test checks for every slice.

## Documentation Strategy

Each slice updates:

- ADRs when durable decisions change;
- `docs/project-status.md`;
- `docs/product/factory-roadmap.md`;
- affected runbooks;
- prompt pack and implementation plan evidence;
- release notes when user-facing behavior changes.
