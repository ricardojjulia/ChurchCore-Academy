# Transcript Request And Issuance Execution Plan

Date: 2026-06-21
Program: ADR-0033 Full SIS Competitive MVP
Slice: 3

## Goal

Deliver a transactional transcript workflow that supports student request intake, registrar issuance, holds, release, revoke, audit events, and release-safe export filtering.

## Tasks

1. Discovery
   - Inspect transcript types, repository, existing API route, revoke route, admin form, and Student PWA documents surface.
   - Identify ID contract mismatch between student profile IDs and person IDs.
   - Confirm existing database migration status for `academy_transcript_issuances`.

2. Red Tests
   - Add transcript service tests for student self-request, cross-student denial, registrar issuance gates, active holds, and role denial.
   - Add export tests proving held/unreleased/non-posted records are excluded.
   - Add route tests for idempotency, student self-scope, registrar list access, and transition dispatch.

3. Domain And Repository
   - Add `TranscriptService`.
   - Extend transcript statuses to `requested`, `held`, `issued`, `released`, and `revoked`.
   - Add repository operations for create request, hold, release, revoke, posted-record check, and active-hold check.
   - Insert immutable transcript events for all state changes.

4. Persistence
   - Add migration for new transcript statuses and state columns.
   - Add `academy_transcript_events` with RLS and immutability trigger.
   - Preserve existing idempotency behavior.

5. API And UI
   - Route `/api/academy/transcripts` by `action=request|issue`.
   - Add hold and release endpoints alongside revoke.
   - Require idempotency keys for mutations.
   - Fix admin transcript roster to use student person IDs.
   - Add Student PWA transcript request button.

6. Documentation
   - Add ADR-0034.
   - Add this design and execution plan.
   - Add transcript operations runbook.
   - Update the full SIS program plan for Slice 3 progress.

7. Verification
   - Focused transcript and route tests.
   - `npx tsc --noEmit`.
   - Targeted ESLint.
   - `npm run db:migrate:local`.
   - `npm test`.
   - `npm run lint`.
   - `npm run build`.

## Review Notes

- This slice intentionally does not add PDF generation or external delivery integrations.
- Transcript holds are local to transcripts until billing/finance/shared holds exist.
- Export filtering is implemented as a pure helper first so later PDF/reporting work can reuse the release-safe rule.
