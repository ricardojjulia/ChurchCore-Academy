# Demo Feedback And Error-Triage Spec (2026-06-11)

## Context

ChurchCore Academy needs a demo-safe feedback and triage system to capture UX bugs, unexpected results, and unhandled UI errors without exposing sensitive data and without introducing LMS-runtime coupling.

## Goals

- Provide global demo feedback capture with explicit feature gating.
- Capture manual and automatic (error-boundary) reports with rich context.
- Enforce server-side validation, identity derivation, and dedup fingerprinting.
- Apply durable, distributed per-session throttling.
- Provide a protected platform-staff triage workspace.

## Non-goals

- No chatbot behavior.
- No LMS runtime behavior in this repo.
- No collection of raw stack traces, request headers, tokens, or provider secrets.
- No browser-trusted identity or client-supplied fingerprint trust.

## Architecture

1. Client layer
- `DemoSessionProvider` for session UUID, breadcrumbs, route, and duration.
- Floating `DemoFeedbackButton` modal for manual reports.
- Global class error boundary for unhandled render errors.

2. API layer
- Submission: `POST /api/academy/demo-feedback`
- Staff list: `GET /api/academy/platform/demo-feedback`
- Staff mutate: `PATCH /api/academy/platform/demo-feedback/:id`

3. Domain layer
- Validation and normalization module.
- Server identity derivation via authenticated server session.
- Server fingerprinting and persistence service.

4. Persistence layer
- `academy_demo_feedback` table + indexes.
- `academy_demo_feedback_rate_limits` table.
- Atomic SQL function `academy_submit_demo_feedback` with advisory lock, sliding window reset, and dedupe upsert.
- RLS for platform staff/admin read/update only.

## Security and privacy

- Demo gate enforced on both browser behavior and server endpoint.
- Identity resolved only on server from authenticated session.
- Fingerprint computed only on server.
- No direct browser inserts into triage table.
- Triage endpoints protected by platform-staff authorization helper.

## Data rules

- Categories: `BUG | ERROR | UNEXPECTED_RESULT | IMPROVEMENT`
- Note max: 2000 chars
- Error message max: 4000 chars
- Breadcrumbs: <= 5 entries, each <= 500 chars
- Session duration: integer 0..2592000
- Demo version: <= 100 chars

## Dedup and rate limiting

- Fingerprint inputs are normalized (trim/lower/collapse whitespace).
- Automatic errors dedupe by route + category + error message.
- Manual reports dedupe by route + category + note.
- Rate limit: 20 accepted submissions per session per 60 seconds.

## UX behavior

- Disabled demo mode: no button, no session listeners/storage, no auto-reporting, non-success submission API.
- Triage workspace includes open/done/all, filters, detail drawer, optimistic updates, and rollback on failed mutation.

## Verification

- Focused tests for validation, fingerprinting, identity derivation, API responses, platform authorization, migration SQL semantics, and client payload behavior.
- Full repo verification with `npm test`, `npm run lint`, `npm run build`.
