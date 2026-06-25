# ADR-0042 — Stripe Payment Integration and PCI Boundary

**Status:** Accepted
**Date:** 2026-06-22
**Deciders:** @ricardojjulia

---

## Context

ADR-0035 established the Academy billing ledger as the financial source of truth. The ledger model supports charges, credits, manual payments, refunds, and void-compatible entry types. `academy_payment_intents` records can store provider name, status, and a safe provider reference.

Stripe is referenced in the `provider` field type union. No Stripe SDK calls exist anywhere in the codebase. No Checkout Session is ever created. No webhook handler exists. Students cannot pay tuition online.

The competitive gap is significant: every major SIS competitor supports online student payment. Faith-based institutions collecting tuition, registration fees, and program fees need a reliable, secure online payment path. Manual payment entry by finance staff is a viable workaround but does not scale to self-service student account management.

PCI DSS scope is a first-class concern. Handling raw card data would require SAQ-D (the most burdensome self-assessment questionnaire). Academy must remain at SAQ-A, which is achievable only if card data never touches Academy servers or Academy-controlled JavaScript.

---

## Decision

Integrate **Stripe Checkout** for online student tuition and fee payments. PCI scope is minimized to SAQ-A by using Stripe-hosted Checkout — card data is entered on Stripe's domain and never touches Academy servers or Academy client-side JavaScript.

**Payment flow:**

1. Admin or finance staff posts a charge to the student's ledger account via the existing billing workflow (no change to this step).
2. Admin can issue a payment link to the student: `POST /api/academy/billing/payment-link` creates a Stripe Checkout Session for the outstanding balance and returns the Checkout URL. The Checkout URL is queued as a communication to the student via `CommunicationsService`.
3. Student can also initiate payment from the Student PWA account surface: the "Pay now" button calls `POST /api/academy/student/billing/pay` which creates a Stripe Checkout Session for the student's current balance and redirects to the Stripe-hosted Checkout page.
4. Stripe Checkout Session is created with `payment_method_types: ['card']`, `mode: 'payment'`, and `metadata: { tenantId, studentId, ledgerAccountId }`.
5. Student completes payment on Stripe's hosted page. No card entry occurs on Academy pages or servers.
6. On success, Stripe fires a webhook to `POST /api/webhooks/stripe`.
7. The webhook handler verifies the event signature using `STRIPE_WEBHOOK_SECRET`, extracts `checkout.session.completed`, reads the metadata, and posts a `credit` ledger entry to the student's account with `source: 'stripe'` and `provider_ref: stripeSessionId`.
8. The student's balance is updated immediately by the new ledger entry. No mutable balance column is touched directly.

**Ledger integration:**

The webhook handler uses the existing `BillingLedgerRepository` to post a credit entry. This is the same code path as a manual credit posted by finance staff — the provider difference is only in the `source` field and `provider_ref`. The ledger remains the source of truth.

**Idempotency:**

The webhook handler checks whether a ledger entry already exists with `provider_ref = stripeSessionId` before inserting. Stripe may deliver the same webhook event more than once. Duplicate processing is silently skipped.

**Environment variables:**

```
STRIPE_SECRET_KEY=sk_live_...        # Never logged, never returned to client
STRIPE_WEBHOOK_SECRET=whsec_...      # Used only for signature verification
STRIPE_PUBLISHABLE_KEY=pk_live_...   # Safe to expose to client
```

**What is never stored or logged:**

- Card number, CVV, expiry, or any payment method token
- Stripe client secret (the Checkout Session client secret is never returned to Academy client code)
- Raw Stripe webhook payloads beyond the fields required for ledger posting
- Payment amounts from Stripe response — the amount for the ledger credit comes from the Academy's own outstanding balance calculation, not from the Stripe response

**PCI scope boundary:**

Academy is SAQ-A eligible under this design:
- No card data is entered on Academy-controlled pages.
- No card data is processed by Academy servers.
- Stripe Checkout is a fully Stripe-hosted payment page.
- The only Academy-controlled touchpoint is the webhook receiver, which sees only a payment confirmation event — not card data.

---

## Consequences

**Positive:**
- Students can pay tuition and fees online from the Student PWA without involving finance staff.
- Finance staff can issue payment links for specific charges or outstanding balances.
- PCI scope remains SAQ-A — no card data exposure risk in Academy code.
- The ledger remains the single source of truth. Stripe is a delivery channel, not a financial record.
- Stripe's webhook retry mechanism means transient failures in the webhook handler are recoverable without data loss.

**Negative:**
- Stripe Checkout adds a third-party redirect in the student payment flow. Students leave the Academy domain to enter payment information.
- Webhook handler failure (unhandled exception, DB timeout) can delay credit posting. The idempotency check means the credit will be posted on the next webhook retry, but there is a window where the student has paid but their balance has not yet updated.
- Stripe's free test-mode credentials must never be committed. Live credentials require Stripe account activation.

---

## Alternatives Considered

### Stripe Elements (embedded card form on Academy pages)

Rejected. Stripe Elements keeps the card entry on the Academy domain and would require SAQ-A-EP or SAQ-D compliance, depending on implementation. SAQ-A via hosted Checkout is a cleaner PCI boundary.

### Square, Braintree, or PayPal

Rejected. Stripe has the broadest documentation, the most straightforward webhook model, and the most predictable behavior for the Academy's integration pattern. Provider swap remains possible via the ledger abstraction without an ADR change.

### Processor as financial source of truth (read balance from Stripe)

Rejected per ADR-0035. The Academy ledger is the financial source of truth. Stripe is the delivery channel for card payments only.

### Manual payment only (no online payment)

Rejected. This is a competitive gap. Faith-based schools need online payment to reduce administrative burden and to meet student expectations.

---

## Review Notes

- **Security/privacy:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must never appear in logs, client responses, or error messages. All Stripe API calls must be server-side only. Verify webhook signatures before processing any event.
- **Testing:** Tests must cover: Checkout Session creation with correct metadata, webhook handler posts credit ledger entry, duplicate webhook is idempotent, invalid webhook signature returns 400, cross-tenant metadata mismatch is rejected, `STRIPE_SECRET_KEY` does not appear in test output.
- **Logging rule:** Do not log payment amounts or card metadata. Log only: session ID, tenant ID, student ID, and outcome status.
- **Rollback:** If the Stripe integration is disabled, outstanding balance display and manual payment posting remain fully functional. The Stripe webhook route simply returns 200 without processing.

---

## Related

- ADR-0035 — Billing Ledger and Payment Boundary
- ADR-0037 — Notification Provider and Retention Boundary
- ADR-0038 — Competitive Acceptance and Deployment Readiness
- ADR-0040 — Email Delivery Provider and Queue Worker
