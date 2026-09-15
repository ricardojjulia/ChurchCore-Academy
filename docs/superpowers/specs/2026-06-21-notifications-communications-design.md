# Notifications And Communications Design

Date: 2026-06-21
Governing ADRs: ADR-0033 Full SIS Competitive MVP Release Program, ADR-0037 Notification Provider And Retention Boundary
Slice: 7

## Purpose

Build communications that complete workflows rather than passive pages. The slice gives ChurchCore Academy a durable notification queue, governed templates, safe provider boundary, and message-center read models.

## Scope

In scope:

- Template rendering for approved SIS workflow messages.
- Audience resolution for student, guardian, staff, and role audiences.
- In-app and email channel queueing.
- Opt-out checks for non-essential email.
- Retry/failure state and safe provider references.
- Immutable audit events for queued, provider handoff, sent, failed, read, and cancelled states.
- API routes to create notifications, list message-center records, and mark messages read.
- Admin communications page.
- Student PWA messages page backed by persisted in-app messages.

Out of scope:

- Live email provider delivery.
- SMS/push providers.
- Bulk marketing campaigns.
- Message deletion or retention automation.
- Rich attachments and file uploads.

## Actors And Roles

- Institution admin, registrar, academic admin, dean, admissions: can create workflow communications and view tenant message records.
- Student: can read and mark only their own in-app messages.
- Guardian: can read messages addressed to the guardian and linked to an authorized student relationship.
- Faculty-only actors can receive workflow assignments but cannot administer communications in this slice.

## Templates

Initial template keys:

- `admissions_decision`
- `registration_confirmation`
- `transcript_update`
- `billing_account_update`
- `grade_release`
- `attendance_concern`
- `workflow_assignment`

Templates are plain text, deterministic, and reject missing variables. Provider secrets and raw payload fields are not accepted as template variables.

## Runtime Behavior

1. A staff workflow or admin form requests a notification.
2. Service checks actor role and template validity.
3. Audience resolver expands the recipient list.
4. Email opt-out is applied to non-essential email messages.
5. Repository inserts idempotent communication rows and audit events.
6. Student and admin message-center pages read persisted rows.
7. Mark-read updates only the recipient's message and writes an audit event.

## Acceptance Criteria

- Template rendering is deterministic and rejects unsafe provider-secret variables.
- Guardian audience resolution requires active guardian relationships.
- Email opt-out suppresses non-essential email queue rows without suppressing in-app records.
- Message creation is idempotent.
- Student cannot read or mark another recipient's messages.
- Admin page and Student PWA messages page use persisted communication records.
- Migration creates RLS-protected communication tables and immutable audit events.
- Focused tests, TypeScript, full test suite, lint, build, and protected-route smoke pass.
