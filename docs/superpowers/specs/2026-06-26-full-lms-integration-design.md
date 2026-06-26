# Full Moodle And Canvas Integration Design

**Date:** 2026-06-26
**Status:** Approved architecture package
**Governing ADR:** ADR-0059
**Council review:** `docs/reviews/2026-06-26-council-review-11-full-lms-integration.md`

## Purpose

Move ChurchCore Academy from LMS contract foundations to full live Moodle and Canvas integration without weakening the Academy/LMS boundary.

This design exists so implementation agents can work from one source of truth before writing provider code.

## Current State

ChurchCore Academy has:

- provider-neutral LMS contract and no-LMS mode;
- Moodle adapter decisions and configuration guide;
- Canvas launch/sync/reconciliation planning modules;
- Student PWA LMS launch orchestration;
- retry/circuit-breaker strategy;
- provider-safe reviewed-import posture.

It does not yet have a fully activated live Moodle + Canvas program with credential validation, live provider HTTP calls, worker execution, sandbox evidence, and provider parity.

## Design Principles

1. Academy is the SIS authority; LMS providers are delivery runtimes.
2. Moodle and Canvas share operation families and acceptance tests.
3. Provider secrets never leave the encrypted provider secret boundary.
4. Provider return data creates reviewed imports, not official records.
5. Provider work runs in a worker/job boundary, not page render.
6. Every provider side effect is idempotent and auditable.
7. Full readiness requires sandbox or tenant test evidence, not mocks alone.

## Architecture

### Provider configuration

Add one provider configuration model for Moodle and Canvas. It stores non-secret metadata such as base URL, provider status, enabled capabilities, launch mode, last validation result, and circuit state summary.

Secrets are stored separately. Runtime code receives resolved secret values only inside the server-side LMS execution layer.

### HTTP clients

Implement provider-specific HTTP clients behind common result types:

- `MoodleHttpClient`: Moodle Web Services REST calls with `wstoken`, `wsfunction`, `moodlewsrestformat=json`, exception-in-200 detection, and Moodle-specific error normalization.
- `CanvasHttpClient`: Canvas REST calls with OAuth2 bearer tokens, token refresh, JSON parsing, pagination support, and Canvas error normalization.

### Execution worker

Create a durable execution boundary for LMS jobs:

- validate credentials
- provision course shells
- sync roster memberships
- create launch response support data
- import grades for review
- import progress for review
- run reconciliation

The worker enforces idempotency, retry policy, circuit breaker state, audit events, and safe failure records.

### Student PWA launch

Student and guardian launch requests must pass Academy access policy first. The PWA receives only:

- availability
- display label
- safe unavailable reason
- launch URL when available
- expiration
- audit reference

It never receives tokens, provider ids that reveal internals, raw errors, or provider payloads.

### Reviewed imports

Grade/progress return data is normalized into reviewed-import records. Academy staff review these records before any official grade, transcript, Student PWA release, ShepherdAI signal, or compliance output changes.

### Reconciliation

Reconciliation compares Academy expected state with provider observed state for mappings, roster, grades, progress, capabilities, and credential health. It recommends actions; it does not silently rewrite official records.

## Implementation Slices

1. Shared provider activation and secret boundary.
2. Moodle live HTTP operations.
3. Canvas live HTTP/OAuth operations.
4. Durable LMS worker, idempotency, retry, and circuit breaker.
5. Student launch, reviewed imports, and reconciliation parity.
6. Activation UI, runbooks, sandbox evidence, and release closeout.

## Testing Strategy

Each slice must include:

- red tests first;
- provider-neutral conformance tests;
- provider-specific HTTP tests with mocked fetch;
- cross-tenant rejection tests;
- idempotency tests;
- secret-redaction tests;
- retry/circuit tests where transport is touched;
- build/lint/test verification before push.

Final readiness additionally requires sandbox-backed evidence for both providers.

## Documentation Requirements

Update these docs as the implementation proceeds:

- `docs/integrations/moodle-provider-configuration.md`
- `docs/integrations/canvas-provider-configuration.md`
- `docs/runbooks/provider-activation.md`
- `docs/product/factory-roadmap.md`
- release/readiness note with evidence

## Non-Goals

- Replacing Academy gradebook with provider gradebook.
- Direct official grade posting from Moodle or Canvas.
- Guardian direct LMS access.
- Canvas destructive SIS batch mode by default.
- Provider-specific LMS code in Student PWA components or Academy domain modules.

## Spec Self-Review

- No placeholder sections remain.
- Canvas and Moodle are both required for full readiness.
- Provider return data is constrained to reviewed imports.
- Sandbox evidence is explicitly required before roadmap completion.

