# Story: Email Delivery Provider

**ID:** T1-02
**Tier:** 1 — Unblock Basic Operations
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story

As an institution admin, I want acceptance letters, grade release notifications, billing statements,
and staff ShepherdAI alerts to actually arrive in email inboxes so that the institution can
communicate with students, guardians, and staff using the platform rather than relying on external
email tools.

So that: the communications queue built in the platform is not a dead-end, and every queued message
with status `queued` is processed, delivered, and tracked with a final status.

## Background

The communications module already has a complete queue: `academy_communication_messages` in
Postgres (created in migration `20260621070000_notifications_communications.sql`), a
`CommunicationsService` that enqueues messages with `status = 'queued'`, and a
`CommunicationTemplateKey` covering `admissions_decision`, `registration_confirmation`,
`transcript_update`, `billing_account_update`, `grade_release`, `attendance_concern`, and
`workflow_assignment`. The table also stores `retry_count`, `provider_reference`, `failure_reason`,
`sent_at`, and `read_at`. However, no provider is wired. No `fetch()` call to any email API exists
in the codebase. Messages queue to Postgres and stop there.

The competitive gap is clear: every competitor (Populi, Sycamore, FACTS) delivers email. Until
ChurchCore Academy delivers email, institutions cannot formally communicate with applicants,
students, or guardians through the platform.

## Acceptance Criteria

1. A worker (Vercel Cron or equivalent) picks up messages with `status = 'queued'` at a regular
   interval (at minimum every 5 minutes in production).
2. Each queued message is submitted to the Resend API (primary provider for T1; provider selection
   documented in ADR-0040).
3. On successful Resend API response, the message is updated to `status = 'sent'`, `sent_at` is set
   to the delivery timestamp, and `provider_reference` is stored with the Resend message ID.
4. On Resend API failure (non-2xx), the message is updated to `status = 'failed'`,
   `failure_reason` is stored with the error body, and `retry_count` is incremented.
5. Failed messages with `retry_count < 3` are retried on the next worker run with exponential
   backoff delay (1 min, 5 min, 15 min).
6. Failed messages with `retry_count >= 3` remain `status = 'failed'` and are not retried
   automatically; an admin can trigger a manual retry from the communications center.
7. Messages with `status = 'sent'` are never re-processed by the worker (idempotency enforced by
   checking status before calling Resend).
8. Invalid email addresses (Resend returns a validation error) are marked `status = 'failed'` with
   `failure_reason = 'invalid_email'` and `retry_count` is set to the maximum so no retry occurs.
9. Recipients with an opted-out preference record (`opted_out = true` in
   `academy_communication_preferences`) for the `email` channel are skipped at enqueue time for
   non-essential messages. Transactional messages (`essential = true`) bypass opt-out for billing
   statements and acceptance letters.
10. The admin communications center page shows each message's current status, `sent_at`, and
    `failure_reason` when present.
11. Students see their own delivered messages (`status = 'sent'` or `'read'`) in the PWA documents
    or notifications surface.

## Edge Cases

- Resend API is completely down: worker exits without marking messages as failed so they remain
  `queued` and will be picked up on the next worker run. The worker must not set `failed` for a
  transient network error — only for explicit 4xx responses that indicate a permanent failure.
- Invalid email address: Resend returns 422 or equivalent; worker marks `failed` with no retry,
  logs the recipient person ID and message ID (never the email address content in logs).
- Opted-out recipient: skip send, set `status = 'cancelled'`, do not increment `retry_count`.
- Duplicate send prevention: before calling Resend, the worker checks `status != 'queued'` for
  that message. If the message was already sent by a concurrent worker run, skip it. The Resend
  idempotency key must be set to the message's `idempotency_key` field to prevent duplicate
  delivery at the provider level.
- Message enqueued for a person with no email address on their people record: mark `failed` with
  `failure_reason = 'no_email_address'` at enqueue time without calling Resend.
- Worker invoked before Resend credentials are configured: worker exits with a logged error and
  leaves all messages `queued`. Never mark messages `failed` due to missing configuration.

## Out of Scope

- SMS delivery (Tier 3).
- In-app push notifications beyond the existing `in_app` channel in the database (Tier 3).
- Scheduled or triggered send sequences (Tier 3, T3-10).
- Unsubscribe link rendering in email body (Tier 2 — for now, opt-out is managed by admin).
- Postmark as an alternative provider (decision deferred to ADR-0040; Resend is the default).
- Delivery analytics beyond status + timestamp (Tier 3).

## Role Matrix

| Role | View all tenant message statuses | View own messages | Trigger manual retry | Cancel queued message |
|------|:--------------------------------:|:-----------------:|:--------------------:|:---------------------:|
| institution_admin | Yes | Yes | Yes | Yes |
| registrar | Yes | Yes | Yes | No |
| academic_admin | Yes | Yes | Yes | No |
| admissions | Yes (admissions messages only) | Yes | No | No |
| finance | Yes (billing messages only) | Yes | No | No |
| faculty | No | Yes | No | No |
| student | No | Yes (own only) | No | No |
| guardian | No | Yes (own only) | No | No |

Note on transactional exemption: billing statements, acceptance letters, and official notifications
with `essential = true` bypass opt-out. This applies to the `admissions_decision` and
`billing_account_update` template keys by default. Institutions may configure additional essential
template keys, but this is out of scope for T1.

## Technical Notes

- Key files to read before implementation:
  - `src/modules/communications/service.ts` — `CommunicationsService`, `createCommunication`,
    enqueue logic, opt-out enforcement
  - `src/modules/communications/types.ts` — `CommunicationMessage`, `CommunicationsRepository`,
    `ProviderFailureInput`
  - `src/modules/communications/postgres-repository.ts` — existing repository methods
  - `supabase/migrations/20260621070000_notifications_communications.sql` — `academy_communication_messages`
    schema, status enum, `retry_count`, `provider_reference`, `failure_reason`, `sent_at`
- The worker should be implemented as a Next.js Route Handler at
  `src/app/api/academy/communications/deliver/route.ts` protected by a shared secret header
  (`x-cron-secret`) rather than a Supabase session, since cron jobs have no user session.
- The Resend API key must be resolved from `process.env.RESEND_API_KEY` at the route layer, never
  inside the module domain functions (per architecture rules).
- The `CommunicationsRepository` interface should be extended with `markSent(tenantId, messageId,
  providerReference, sentAt)` and `incrementRetry(tenantId, messageId, failureReason)` methods.
  The existing `markProviderFailure` partially covers this — audit before adding duplicate methods.
- Do not use the Resend Node.js SDK if it requires a version incompatible with Node.js 20. Prefer
  a direct `fetch()` call to `https://api.resend.com/emails` with the documented JSON body to
  minimize added dependencies (ADR-0040 should justify the choice).
- The `status` column already accepts `'sent'` and `'failed'` per the migration check constraint.
  Verify `'cancelled'` is in the check constraint before using it; add a migration if not.
- Log delivery outcomes using the `observability` module patterns already in the codebase. Never
  log email body content or recipient email addresses in full.

## Tests Required

- `src/modules/communications/__tests__/delivery-worker.test.ts`:
  - Success: worker processes a queued message, calls mock Resend API, updates status to `sent`
    with `provider_reference` and `sent_at`.
  - Permanent failure: mock Resend returns 422; worker sets `status = 'failed'`,
    `failure_reason = 'invalid_email'`, `retry_count` at maximum.
  - Transient failure: mock Resend returns 503; worker leaves message `queued` (does not mark
    failed), increments `retry_count`.
  - Opt-out skip: recipient has `opted_out = true`; non-essential message is set to `cancelled`.
  - Opt-out bypass: recipient has `opted_out = true`; essential (`admissions_decision`) message
    is sent regardless.
  - Idempotency: message already `status = 'sent'`; worker skips the message without calling
    the mock Resend API.
  - Cross-tenant isolation: worker only processes messages belonging to the configured tenant
    context; no cross-tenant message processing.
  - Missing email address: message for a person with no email is marked `failed` with
    `failure_reason = 'no_email_address'` without calling Resend.
