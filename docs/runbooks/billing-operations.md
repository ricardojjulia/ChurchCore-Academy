# Billing Operations Runbook

Date: 2026-06-21
Owner: Finance / Registrar Operations
Related ADR: ADR-0035 Billing Ledger And Payment Boundary

## Purpose

Operate the MVP student account workflow without storing payment credentials or using the payment processor as the source of truth.

## Ledger Rules

- Charges increase the student balance.
- Credits decrease the student balance.
- Payments decrease the student balance.
- Ledger entries are immutable.
- Idempotency keys are required for every mutation.
- The Academy ledger is the source of truth; providers are processors only.

## Admin Posting

1. Open `/admin/billing`.
2. Select a student.
3. Choose one action:
   - Assess charge
   - Apply credit
   - Post manual payment
4. Enter a positive amount and description.
5. For manual payments, enter a receipt or reference.
6. Submit.

Expected result: one ledger entry appears after refresh, and the student balance reflects the signed ledger amount.

## Student Account

1. Student opens `/student/account`.
2. Student sees current balance and ledger entries.
3. If balance is above zero, student can create a safe payment intent.

The current MVP payment intent does not collect card data and does not return a client secret. Live provider handoff is deferred.

## Troubleshooting

- `Idempotency-Key is required.`: client must send the header or body key.
- `amountCents must be a positive integer.`: send cents as an integer, not a decimal dollar string.
- `Forbidden student account administration access.`: actor lacks billing admin authority.
- `Students can read only their own student account.`: student tried to access another account.
- Missing balance after posting: refresh the page; the current UI does not live-revalidate the server-rendered summary.

## Controls

- Do not store card numbers, CVV, payment method secrets, raw provider responses, or client secrets.
- Do not manually edit ledger rows.
- Do not delete ledger rows. Post corrective credits, payments, refunds, or void entries instead.
- Do not treat payment-intent status as payment received until a ledger payment is posted.

## Deferred Work

- Stripe checkout and signed webhook ingestion.
- Refund and void UI.
- Payment plans and installments.
- Student account holds shared with transcript and registration.
- Accounting export.
- Financial aid disbursement posting.
