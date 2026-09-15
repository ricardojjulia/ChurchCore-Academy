# Story: Stripe Payment Collection
**ID:** T2-01
**Tier:** 2 — Complete Core SIS Workflows
**Status:** Implemented in Sprint B / PR #62
**Date:** 2026-06-22

## User Story

As an institution admin or finance officer, I want to generate a Stripe-hosted payment link for a student's outstanding balance so that students can pay tuition online without card data ever touching ChurchCore servers.

As a student, I want to complete payment through Stripe Checkout from my account page in the PWA so that I can satisfy my balance without contacting the office.

## Background

The billing ledger, `BillingPaymentIntent` model, `academy_payment_intents` table, and `BillingService` already exist in `src/modules/billing/`. The `BillingPaymentProvider` type includes `"stripe"`, and `createPaymentIntent` / `markPaymentPosted` methods are wired to the Postgres repository. Zero Stripe SDK calls exist anywhere in the codebase. The student sees their account balance at `src/app/student/account/` but there is no pay button and no Stripe checkout flow. The admin billing page at `src/app/admin/billing/` can post manual ledger entries but cannot generate payment links.

## Acceptance Criteria

1. Admin or finance officer can generate a Stripe Checkout Session for a specific student and amount; the resulting hosted URL is emailed to the student via the existing communications queue.
2. Student can initiate checkout from the PWA account page (`/student/account`) using the Stripe-hosted URL; no card data is submitted to ChurchCore servers.
3. A Stripe webhook handler at `POST /api/academy/billing/stripe-webhook` verifies the Stripe signature before processing any event.
4. On receipt of a verified `checkout.session.completed` event, the handler calls `BillingService.postPayment()` with a deterministic idempotency key derived from the Stripe session ID, posting a ledger credit of type `"payment"` with `sourceType: "payment"`.
5. The student's account balance is updated immediately after the ledger credit is posted; the student sees the updated balance on next page load.
6. Payment history (all ledger entries of type `"payment"`) is visible to the student on `/student/account` and to admin on `/admin/billing/`.
7. The Stripe `client_secret` is never logged, stored in plain text, or returned to any client response. The `clientSecretRedacted: true` sentinel on `BillingPaymentIntent` is enforced at the API layer.
8. PCI scope is SAQ-A: ChurchCore servers handle only the Stripe-issued Checkout Session URL; all card entry occurs on Stripe-hosted pages.

## Edge Cases

- Webhook received twice for the same Stripe session ID: idempotency key derived from the session ID prevents duplicate ledger credit; second call returns 200 with no new entry posted.
- Checkout session expires before student pays: student can request a new payment link from the admin or (in a later tier) self-service from the PWA. The expired `academy_payment_intent` row is marked `status: "voided"`.
- Partial payment (student pays less than the outstanding balance): the exact amount from the Stripe session is credited; the remaining balance remains. No automatic splitting of charges.
- Refund required: admin posts a manual ledger entry of type `"refund"` via the existing `applyCredit` flow. No automated Stripe refund API call in v1.
- Stripe webhook delivery fails or arrives out of order: handler must be idempotent and must not assume order. Missing events should be reconcilable via Stripe dashboard; no automated reconciliation in v1.
- Student belongs to a different tenant than the actor generating the link: `BillingService` enforces `actor.tenantId` on all repository calls; cross-tenant generation is rejected with 403.

## Out of Scope

- Automated payment plans or recurring billing (Tier 3 / ADR-0047).
- Apple Pay, Google Pay, or other wallet methods (configurable in Stripe dashboard, not in Academy code).
- Automated Stripe refunds via API.
- Student self-service payment link generation from the PWA without admin involvement.
- Stripe Connect or multi-account payouts.

## Role Matrix

| Action | student | finance | registrar | academic_admin | institution_admin | platform_admin |
|--------|:-------:|:-------:|:---------:|:--------------:|:-----------------:|:--------------:|
| View own account balance | ✓ | — | — | — | — | — |
| View any student balance | — | ✓ | ✓ | ✓ | ✓ | — |
| Generate payment link | — | ✓ | ✓ | ✓ | ✓ | — |
| Complete Stripe checkout | ✓ | — | — | — | — | — |
| View payment history (own) | ✓ | — | — | — | — | — |
| View payment history (any student) | — | ✓ | ✓ | ✓ | ✓ | — |
| Post manual credit/refund | — | ✓ | ✓ | — | ✓ | — |

## Technical Notes

- **Billing module:** `src/modules/billing/` — `types.ts`, `service.ts`, `postgres-repository.ts`. `BillingService.createPaymentIntent()` creates the intent row. `BillingService.postPayment()` posts the ledger credit after webhook.
- **Stripe integration:** Add `stripe` npm package (document reason in PR). Stripe SDK must be instantiated only at the route layer or a dedicated Stripe client module in `src/lib/stripe.ts`. The secret key must be resolved from `process.env` at the route layer, never inside module domain functions (CLAUDE.md rule).
- **Webhook route:** New route at `src/app/api/academy/billing/stripe-webhook/route.ts`. Must read the raw request body as a `Buffer` before passing to `stripe.webhooks.constructEvent()`. Next.js App Router requires disabling body parsing with `export const config = { api: { bodyParser: false } }` or using `request.text()`.
- **Idempotency key:** Derive from Stripe session ID: `stripe-session-${sessionId}`. Pass to `BillingService.postPayment()`. The `academy_payment_intents` table has an `idempotency_key` unique constraint.
- **`clientSecretRedacted: true`:** The `BillingPaymentIntent` type carries this sentinel. The billing API route must never echo a raw client secret back to callers; `buildProviderSafePaymentIntent()` in `service.ts` enforces this.
- **Migrations:** The `academy_payment_intents` and `academy_billing_ledger` tables are already created in migration `20260621050000_billing_student_accounts.sql`. A new migration will be needed only if Stripe-specific columns (e.g., `stripe_checkout_session_id`) are added to the intent row.
- **RLS:** Both tables have RLS enabled. Finance/admin roles have read/write access; the `authenticated` grant covers student reads of their own rows via row-level policy.
- **Email:** After generating the checkout URL, enqueue a message via the existing communications module to deliver the link. Do not call an email provider directly from the billing route.
- **Existing tests:** `src/modules/billing/__tests__/service.test.ts` covers `BillingService`. New tests must cover webhook handler logic in isolation without a live Stripe API.
- **ADR reference:** ADR-0042 (Stripe payment integration and PCI boundary) must be written before implementation begins.

## Tests Required

- `BillingService.createPaymentIntent()` success: returns a `BillingPaymentIntent` with `clientSecretRedacted: true`; client secret must not appear in test output (`doesNotMatch`).
- `BillingService.createPaymentIntent()` validation: rejects non-positive `amountCents`.
- `BillingService.createPaymentIntent()` cross-tenant rejection: actor with `tenantId: "A"` cannot create an intent for `studentPersonId` on tenant `"B"`.
- Webhook handler success: valid Stripe signature + `checkout.session.completed` event → `postPayment()` called once with correct idempotency key → ledger entry posted.
- Webhook handler idempotency: second call with same session ID → no second ledger entry created (repository returns existing entry, no duplicate).
- Webhook handler rejection: invalid Stripe signature → 400 returned, no ledger entry posted.
- `BillingService.postPayment()` success: posts a `"payment"` entry with negative `amountCents` (credit) to the ledger.
- `BillingService.postPayment()` non-admin rejection: student actor calling `postPayment()` for their own account is rejected (admin-only operation).
