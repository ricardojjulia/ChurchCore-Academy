# Production Observability Instrumentation Design

Date: 2026-06-21  
Governing review: `docs/reviews/2026-06-21-council-review-9-release-closeout.md`

## Problem

Council Review IX allowed controlled pilot use but identified production observability as an open gate. The app had many protected APIs and provider workers, but failure telemetry was inconsistent and could rely on ad hoc console output.

## Decision

Add a small structured operational-event boundary for production-relevant failures:

- authentication failures;
- authorization failures;
- unexpected workflow exceptions;
- migration errors;
- LMS provider worker failures.

Events must be JSON-serializable, include operation/category/severity/status when available, and redact secrets, credentials, authorization values, tokens, raw payloads, and suspicious sensitive string values.

## Architecture

`src/modules/observability/operational-events.ts` owns event construction, recursive metadata redaction, and the default console sink. Runtime code may pass a test sink to verify emitted events without reading console output.

Integration points:

- `handleApi()` emits auth, authorization, unexpected API, and workflow exception events.
- workflow routes pass `workflow.*` operation names.
- `executeLmsProviderOperations()` emits `provider_worker_failure` for retryable, permanent, or conflict provider outcomes.
- `scripts/db-migrate-local.ts` emits `migration_error` before exiting on migration failure.

## Boundaries

This slice does not add a third-party observability vendor, dashboards, alert routing, or OpenTelemetry exporters. The sink boundary is intentionally small so a later deployment can forward events to a provider without changing application call sites.

## Acceptance Criteria

1. Structured events redact secrets recursively.
2. API auth and authorization failures emit categorized events.
3. Workflow exceptions emit `workflow_exception`.
4. LMS provider worker failures emit `provider_worker_failure`.
5. Migration failures emit `migration_error`.
6. Runbook and project status identify this as the controlled-pilot observability foundation.
