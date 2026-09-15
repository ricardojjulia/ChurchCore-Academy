# Billing, Payments, And Student Accounts Design

Date: 2026-06-21
Governing ADRs: ADR-0033 Full SIS Competitive MVP Release Program, ADR-0035 Billing Ledger And Payment Boundary
Slice: 4

## Purpose

Introduce a minimal but real student account ledger so tuition-charging institutions can post charges, credits, and manual payments while students can view their account balance.

## Scope

In scope:

- Student account table.
- Immutable billing ledger entries.
- Payment intent records without stored secrets.
- Admin billing page for charges, credits, and manual payments.
- Student PWA account page for balance, ledger, and safe payment-intent creation.
- API route for statement reads and billing mutations.
- Role gates for billing administration.
- Student self-scope for account visibility and payment-intent creation.

Out of scope:

- Stripe live checkout.
- Card storage, payment method storage, or raw provider payload storage.
- Financial aid packaging.
- Refund workflow UI.
- Payment plans.
- Accounting-system export.

## Actors And Roles

- Institution admin, registrar, academic admin, dean: can administer student accounts.
- Student: can read only their own account and create a payment intent only for their own balance.
- Faculty, guardian, applicant: no billing mutation access in this slice.

## Data Boundary

Primary writes:

- `academy_student_accounts`
- `academy_billing_ledger_entries`
- `academy_payment_intents`

Primary reads:

- `academy_student_profiles`
- `academy_people`
- `academy_billing_ledger_entries`
- `academy_payment_intents`

All runtime access uses verified Academy actor identity and request-scoped database context.

## Runtime Behavior

1. Admin posts charge, credit, or manual payment from `/admin/billing`.
2. API requires an idempotency key for mutations.
3. Service validates actor role, positive amount, currency, and student subject.
4. Repository ensures the student account exists.
5. Ledger entry is inserted idempotently and never updated or deleted.
6. Student opens `/student/account`.
7. Student statement computes balance from ledger entries.
8. Student can create a provider-safe manual payment intent; no card data or client secret is returned.

## Acceptance Criteria

- Ledger entries are append-only and tenant-scoped.
- Charges post positive amounts.
- Credits and payments post negative amounts.
- Payment provider output is redacted and does not expose client secrets.
- Student actor cannot read or create payment intents for another student.
- Non-billing roles cannot mutate student accounts.
- Admin billing and Student PWA account pages are reachable through navigation.
- Migration replay, focused tests, TypeScript, lint, and build pass.
