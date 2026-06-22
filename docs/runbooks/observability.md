# Observability Runbook

Date: 2026-06-21  
Governing review: `docs/reviews/2026-06-21-council-review-9-release-closeout.md`

## Purpose

ChurchCore Academy emits structured operational events for controlled-pilot failure paths. These events are safe for logs because metadata is recursively redacted before emission.

## Event Categories

| Category | Severity | Source | Operator action |
| --- | --- | --- | --- |
| `authentication_failure` | `warn` | Protected API request without a valid session | Check Supabase session state, account links, active tenant selection, and login flow. |
| `authorization_failure` | `warn` | Verified actor lacking required role or tenant scope | Check role assignment, tenant scope, and role-matrix evidence. |
| `workflow_exception` | `error` | ShepherdAI/workflow API unexpected failure | Preserve correlation data, inspect workflow/action rows, and pause affected workflow automation. |
| `unexpected_api_error` | `error` | Non-workflow API unexpected failure | Inspect application logs and database health; do not expose raw error text to users. |
| `migration_error` | `critical` | Migration runner failure | Stop deployment, preserve migration output, inspect `schema_migrations`, and roll forward with a new migration. |
| `provider_worker_failure` | `warn` or `error` | LMS provider worker retryable/permanent/conflict result | Check provider status, idempotency key, tenant credential activation, and provider runbook. |

## Redaction Rules

The event boundary redacts metadata keys matching authorization, password, secret, token, credential, raw, or payload. It also redacts string values that look like sensitive key/value pairs, such as `password=...`.

Never add raw provider responses, access tokens, cookies, service-role keys, or full request payloads to event metadata.

## Verification

Run focused observability tests before deployment:

```bash
node --import tsx --test src/modules/observability/__tests__/operational-events.test.ts src/app/api/academy/__tests__/api-utils.test.ts src/modules/lms-contract/__tests__/lms-execution-worker.test.ts
```

Run the full release gate before promoting a pilot build:

```bash
npm test
npm run lint
npm run build
git diff --check
```

## Provider Integration

The current sink writes JSON to standard application logs. A later log drain, alerting provider, or OpenTelemetry exporter should consume the same `OperationalEvent` shape and must preserve the redaction boundary.
