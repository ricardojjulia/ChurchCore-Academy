# Notifications And Communications Execution Plan

Date: 2026-06-21
Program: ADR-0033 Full SIS Competitive MVP
Slice: 7

## Goal

Deliver durable in-app notifications and provider-safe email queue foundations for workflow communications across admissions, registration, transcripts, billing, grade release, attendance concerns, and workflow assignments.

## Tasks

1. Discovery
   - Inspect current placeholder message surfaces and toast helpers.
   - Inspect people/guardian relationship schema and auth policy patterns.
   - Confirm prior workflow slices can supply source event metadata.

2. Red Tests
   - Add service tests for template rendering, audience resolution, opt-out behavior, idempotent queueing, provider-safe output, retry/failure, audit, and recipient reads.
   - Add migration tests for communication tables, RLS, opt-out table, and immutable audit events.
   - Add route tests for create, list, mark-read, role gates, and student self-scope.

3. Domain And Persistence
   - Add `src/modules/communications` types, templates, audience resolver, service, and Postgres repository.
   - Add migration for messages, preferences, and audit events.
   - Keep provider integration as a queue boundary.

4. API And UI
   - Add `/api/academy/communications`.
   - Add `/admin/communications`.
   - Replace `/student/messages` placeholder with persisted in-app messages.
   - Add admin shell navigation and dashboard action.

5. Documentation
   - Add ADR-0037.
   - Add design spec and this execution plan.
   - Add communications runbook.
   - Update project status and full SIS tracker.

6. Verification
   - Focused communications tests.
   - `npx tsc --noEmit`.
   - `npm run db:migrate:local`.
   - `npm test`.
   - `npm run lint`.
   - `npm run build`.
   - Protected-route HTTP smoke and in-app Browser attempt when available.

## Review Notes

- This slice creates delivery-ready queue records but not live email delivery.
- Communications are student-record support evidence and are not destructively deleted.
- Provider payloads and secrets stay outside Academy persistence.
