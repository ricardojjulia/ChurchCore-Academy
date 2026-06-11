# Demo Feedback And Error-Triage Implementation Plan (2026-06-11)

## Stage 1: Discovery and baseline

- Read repository guardrails and software-factory workflow.
- Locate provider, API route, auth, migration, and test conventions.
- Confirm no parallel architecture introduction.

## Stage 2: Data model and migration

- Add migration for feedback records and rate-limit state.
- Add constraints, indexes, and RLS policies.
- Add atomic SQL submission function with dedupe upsert and 20/60 limit.

## Stage 3: Server module and APIs

- Implement shared validation and normalization.
- Implement server identity derivation and server fingerprinting.
- Implement submit/list/update service and API handlers.
- Map rate-limit rejection to HTTP 429 and generic persistence failures to HTTP 500.

## Stage 4: Client capture and error boundary

- Implement global demo session provider.
- Implement floating feedback modal/button.
- Implement class-based global error boundary reporting.
- Ensure gated inert behavior when demo mode is disabled.

## Stage 5: Staff triage workspace

- Add protected staff page and protected list/mutation endpoints.
- Add filters, open/done/all views, detail drawer, action selector, processed toggle.
- Implement optimistic updates and rollback on failure.

## Stage 6: Testing and verification

- Add focused tests for required behaviors and migration semantics.
- Run repository verification commands:
  - `npm test`
  - `npm run lint`
  - `npm run build`

## Stage 7: Documentation and handoff

- Update README with environment flags and operational caveats.
- Add changelog entry.
- Add run notes with migration order and residual risks.
- Deliver summary with changed files and verification results.
