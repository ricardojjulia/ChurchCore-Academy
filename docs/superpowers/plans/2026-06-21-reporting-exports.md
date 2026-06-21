# Reporting And Exports Execution Plan

Date: 2026-06-21
Program: ADR-0033 Full SIS Competitive MVP
Slice: 6

## Goal

Deliver canonical reporting and CSV exports for administrators and accreditation-prep workflows across enrollment, admissions, attendance, grades, transcripts, billing, aid, retention, and program completion.

## Tasks

1. Discovery
   - Inspect existing `/admin/reporting` page and reporting reviews.
   - Identify source tables from prior workflow slices.
   - Confirm API patterns for verified actor identity and route tests.

2. Red Tests
   - Add reporting service tests for supported report definitions, role gates, dashboard rows, and CSV output.
   - Add route tests for JSON, CSV, invalid report types, and forbidden actors.

3. Domain And Persistence
   - Add `src/modules/reporting` types, CSV helpers, service, and Postgres repository.
   - Keep this slice read-only; no migration is required.
   - Protect CSV against formula injection.

4. API And UI
   - Add `/api/academy/reports`.
   - Replace `/admin/reporting` page-local aggregation with the reporting service.
   - Add export links for each report.

5. Documentation
   - Add design spec and this execution plan.
   - Add reporting exports runbook.
   - Update the full SIS program tracker.

6. Verification
   - Focused reporting tests.
   - `npx tsc --noEmit`.
   - `npm test`.
   - `npm run lint`.
   - `npm run build`.
   - Protected-route HTTP smoke and in-app Browser attempt when available.

## Review Notes

- ATS/IPEDS-ready means export foundations only, not certified regulatory filing.
- Report exports must be tenant-scoped by the verified actor.
- CSV output is intentionally simple and dependency-free.
