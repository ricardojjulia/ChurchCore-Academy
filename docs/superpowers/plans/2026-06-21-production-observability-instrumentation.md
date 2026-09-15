# Production Observability Instrumentation Plan

Spec: `docs/superpowers/specs/2026-06-21-production-observability-instrumentation-design.md`  
Governing review: `docs/reviews/2026-06-21-council-review-9-release-closeout.md`

## Scope

Implement Council Review IX Prompt B by adding structured, redacted operational events for critical controlled-pilot failure paths.

## Tasks

- [x] Add operational event model, redaction, and default sink.
- [x] Emit authentication, authorization, unexpected API, and workflow exception events from `handleApi()`.
- [x] Tag workflow routes with `workflow.*` operations.
- [x] Emit provider worker failure events from the LMS execution worker.
- [x] Emit migration failure events from the local migration runner.
- [x] Add focused tests for redaction, API failure events, and provider failure events.
- [x] Add observability runbook and update release/status docs.

## Verification

```bash
node --import tsx --test src/modules/observability/__tests__/operational-events.test.ts src/app/api/academy/__tests__/api-utils.test.ts src/modules/lms-contract/__tests__/lms-execution-worker.test.ts
npm test
npm run lint
npm run build
git diff --check
```

## Remaining Work

Third-party log drain, alert routing, dashboards, and OpenTelemetry exporters remain post-foundation deployment work. They should attach to the event sink boundary instead of adding provider-specific logging throughout domain modules.
