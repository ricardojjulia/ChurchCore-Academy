# ADR-0040 — Email Delivery Provider and Queue Worker

**Status:** Accepted
**Date:** 2026-06-22
**Deciders:** @ricardojjulia

---

## Context

ADR-0037 established the Academy communication queue. `CommunicationsService` correctly enqueues messages to `academy_communications_messages` with `status: queued` and stores all required fields: recipient, channel, subject, body, source workflow, retry metadata, and a safe provider-reference slot.

No delivery worker exists. No provider is wired. Every message enqueued since Slice 8 has remained in `status: queued` and has never been sent. This affects:

- admissions decision notifications
- registration confirmation emails
- transcript status change notices
- billing statements and payment receipts
- attendance concern flags to guardians
- grade-release notifications to students

The gap makes every workflow that depends on outbound communication appear broken to end users. Acceptance criteria for ADR-0038 require live provider activation before a controlled pilot.

---

## Decision

Adopt **Resend** (resend.com) as the Academy email delivery provider. Add a delivery worker function that polls the queue, delivers via the Resend REST API, and writes outcome back to the Academy record.

**Provider rationale:**

Resend exposes a simple, single-endpoint REST API (`POST /emails`). It does not require SMTP configuration, MX record manipulation, or a provider SDK that diverges from Academy dependency patterns. Its free tier covers pilot-scale volume. Domain verification is a one-time DNS step. Provider reference IDs are stable and safe to store as audit references.

**Worker location:** `src/lib/email-worker.ts`

**Worker contract:**

```ts
export async function runEmailDeliveryWorker(client: PoolClient): Promise<void>
```

The worker:

1. Queries `academy_communications_messages` for rows where `channel = 'email'` and `status = 'queued'` and `retry_count < 5`, ordered by `created_at` ascending, limit 50 per run.
2. For each message, calls `POST https://api.resend.com/emails` with `Authorization: Bearer ${RESEND_API_KEY}`.
3. On HTTP 200/201: updates the row to `status: 'delivered'`, sets `provider_ref` to the Resend message ID, clears `last_error`.
4. On non-2xx response: increments `retry_count`, sets `last_error` to the HTTP status code (not the response body), sets `status: 'failed'` only when `retry_count >= 5`.
5. Never stores raw provider response bodies, headers, or secrets in Academy records.

**Cron schedule:** Vercel Cron job at `api/cron/email-worker` running every 60 seconds (`* * * * *`). The route resolves a service-role Postgres client, calls `runEmailDeliveryWorker`, and returns HTTP 200. Route is protected by `CRON_SECRET` header verification as required by Vercel.

**Environment variables:**

```
RESEND_API_KEY=re_...          # Resend API key — never logged
CRON_SECRET=...                # Vercel Cron shared secret for route authentication
```

**What is never stored or logged:**

- The full Resend API response body
- Resend API key
- Recipient list beyond the stored `recipient` field already in the record
- Rendered email HTML beyond the stored `body` field already in the record

**Retry and failure handling:**

Transient delivery failures (network timeout, 429 rate limit, 5xx) increment `retry_count` and leave the message in `status: queued`. After 5 failed attempts the message moves to `status: failed` and the staff message center surfaces it for manual review. No automatic requeue beyond 5 attempts without staff action.

---

## Consequences

**Positive:**
- Every workflow that queues an email now delivers it within 60 seconds.
- Delivery outcome (success, failure, provider reference) is recorded in the Academy audit record.
- The communications module API is unchanged — the worker is purely an infrastructure consumer.
- Retry logic is self-contained and does not require additional queue infrastructure.
- Provider swap (from Resend to another provider) requires only changing the worker's HTTP call and the env var — the queue schema and module API are unaffected.

**Negative:**
- The Vercel Cron free tier allows one invocation per minute. High-volume institutions needing sub-minute delivery will need a plan upgrade or a separate queue consumer.
- Batch size of 50 per run caps delivery throughput at approximately 3,000 messages per hour. This is sufficient for pilot scale.
- Resend requires domain verification. The Academy domain must have DNS records configured before live email delivery will work.

---

## Alternatives Considered

### SendGrid

Rejected for MVP. SendGrid's API is more complex, has a more expensive entry point, and requires additional sender identity setup. Resend's simpler API reduces integration surface.

### AWS SES

Rejected for MVP. SES requires AWS account setup, IAM role configuration, and sandbox-mode lifting. Operational overhead is disproportionate to pilot scale.

### Nodemailer with SMTP

Rejected. SMTP credentials would need to be stored in env vars and rotated. SMTP configuration varies by provider and adds failure modes (TLS, port blocking, IP reputation) that Resend's hosted API avoids.

### Dedicated background worker process (e.g., Bull/BullMQ with Redis)

Rejected. Introduces Redis and a persistent worker process. Vercel Cron is sufficient for the delivery latency requirements at this scale and keeps the deployment footprint minimal.

---

## Review Notes

- **Security/privacy:** `RESEND_API_KEY` must never appear in logs, responses, or error messages. The worker must call `doesNotMatch` on log output in tests.
- **Testing:** Tests must cover: successful delivery updates status to delivered, non-2xx response increments retry_count, fifth failure sets status to failed, messages with retry_count >= 5 are skipped, cross-tenant data cannot be accessed by the worker (service-role context only).
- **Opt-out:** The worker must check the `opt_out` flag on the message record before delivering. `CommunicationsService` already sets this; the worker must not bypass it.
- **PCI:** No payment data travels through the email worker. Billing notices contain account balance information — amounts are acceptable in message body per ADR-0035; raw card data is never present.

---

## Related

- ADR-0037 — Notification Provider and Retention Boundary
- ADR-0035 — Billing Ledger and Payment Boundary
- ADR-0038 — Competitive Acceptance and Deployment Readiness
