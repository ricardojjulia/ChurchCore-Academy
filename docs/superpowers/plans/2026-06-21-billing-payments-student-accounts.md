# Billing, Payments, And Student Accounts Execution Plan

Date: 2026-06-21
Program: ADR-0033 Full SIS Competitive MVP
Slice: 4

## Goal

Deliver the first operational finance workflow: Academy-owned student account ledger, admin charge/credit/payment posting, provider-safe payment intents, and student account visibility.

## Tasks

1. Discovery
   - Confirm no existing billing schema or finance routes exist.
   - Read Council VII factory prompt and production remediation billing boundary.
   - Inspect admin shell and Student PWA navigation patterns.

2. Red Tests
   - Add service tests for signed ledger entries, payment posting, provider redaction, role gates, and student account self-scope.
   - Add migration tests for account, ledger, payment intent, RLS, immutability, and no provider secrets.
   - Add API route tests for idempotency and student defaults.

3. Domain And Persistence
   - Add `src/modules/billing` types, service, and Postgres repository.
   - Add migration for student accounts, immutable ledger entries, and payment intents.
   - Keep payment provider integration as a boundary, not a live processor.

4. API And UI
   - Add `/api/academy/billing`.
   - Add `/admin/billing` with account metrics, student balances, and action form.
   - Add `/student/account` with balance, ledger entries, and safe payment-intent action.
   - Add AdminShell, dashboard, and Student PWA navigation entries.

5. Documentation
   - Add ADR-0035.
   - Add design spec and this execution plan.
   - Add billing operations runbook.
   - Update the full SIS program plan.

6. Verification
   - Focused billing tests.
   - `npx tsc --noEmit`.
   - `npm run db:migrate:local`.
   - `npm test`.
   - `npm run lint`.
   - `npm run build`.
   - Protected-route HTTP smoke when in-app Browser is unavailable.

## Review Notes

- This slice does not collect card data or perform live Stripe checkout.
- Manual payment posting is sufficient for MVP operational proof and keeps the payment boundary safe.
- Financial aid will post through this ledger in Slice 5 but is not implemented here.
