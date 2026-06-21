# Financial Aid Foundation Execution Plan

Date: 2026-06-21
Program: ADR-0033 Full SIS Competitive MVP
Slice: 5

## Goal

Deliver institutional financial aid as an operational workflow: package creation, award lifecycle, disbursement scheduling, ledger posting, holds, admin controls, and student visibility.

## Tasks

1. Discovery
   - Confirm no existing financial-aid schema or routes exist.
   - Read Council VII factory prompt and production remediation finance boundary.
   - Inspect billing ledger, admin shell, and Student PWA patterns.

2. Red Tests
   - Add service tests for package creation, institutional awards, disbursement scheduling, ledger posting, student visibility, role gates, and federal-aid rejection.
   - Add migration tests for aid tables, RLS, federal exclusion, and ledger linkage.
   - Add API route tests for student default reads, idempotency validation, and award creation.

3. Domain And Persistence
   - Add `src/modules/financial-aid` types, service, and Postgres repository.
   - Add migration for packages, awards, disbursements, holds, RLS, and billing ledger foreign-key linkage.
   - Keep federal/regulated aid disabled behind ADR-0036.

4. API And UI
   - Add `/api/academy/financial-aid`.
   - Add `/admin/financial-aid` with metrics, record lists, and action form.
   - Add `/student/aid` with student-visible award, disbursement, and hold summary.
   - Add AdminShell, dashboard, and Student PWA navigation entries.

5. Documentation
   - Add ADR-0036.
   - Add design spec and this execution plan.
   - Add financial-aid operations runbook.
   - Update the full SIS program plan.

6. Verification
   - Focused financial-aid tests.
   - Student PWA shell config test.
   - `npx tsc --noEmit`.
   - `npm run db:migrate:local`.
   - `npm test`.
   - `npm run lint`.
   - `npm run build`.
   - Protected-route HTTP smoke when in-app Browser is unavailable.

## Review Notes

- This slice is institutional aid only.
- Aid disbursements post into the existing immutable billing ledger as credits.
- Regulated aid activation requires a separate compliance ADR and release gate.
