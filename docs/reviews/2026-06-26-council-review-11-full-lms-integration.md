# Council Review XI — Full Moodle And Canvas Integration

**Date:** 2026-06-26
**Scope:** Evaluate what is required for ChurchCore Academy to move from provider-neutral LMS foundations to full live Moodle and Canvas integration.
**Requested by:** Ricardo Julia
**Reported to:** ChurchCore Academy Software Factory
**Decision output:** ADR-0059 and `docs/prompts/2026-06-26-full-lms-integration-prompts.md`

## Executive Verdict

ChurchCore Academy has the correct LMS architecture foundation but does not yet have complete live Moodle and Canvas integrations.

The existing provider-neutral LMS contract, Student PWA launch boundary, Moodle provider configuration, Canvas provider configuration, reviewed-import posture, retry/circuit-breaker ADR, and reconciliation modules are valid foundations. The next work should not be another planning-only adapter sprint. It should be a full live-provider integration program that proves both providers through sandbox credentials, live HTTP clients, worker execution, idempotent sync, reviewed imports, reconciliation evidence, and tenant activation runbooks.

Council recommendation: approve ADR-0059 and execute the implementation in six factory slices. Do not claim production LMS readiness until both Moodle and Canvas pass the same acceptance matrix.

## Current Repo State

Implemented or foundation-present:

- Provider-neutral LMS contract and no-LMS mode: ADR-0014.
- Moodle adapter architecture and credential boundary: ADR-0015 and ADR-0016.
- Shared HTTP retry/circuit-breaker strategy: ADR-0046.
- Moodle configuration guide: `docs/integrations/moodle-provider-configuration.md`.
- Canvas configuration posture and contract modules: `docs/integrations/canvas-provider-configuration.md`, `src/modules/lms-contract/canvas-*`.
- Student PWA LMS launch route and provider-neutral orchestration.
- Moodle and Canvas plan/reconciliation/read-model tests around contract behavior.

Missing for full live integration:

- Tenant-scoped credential/config persistence that supports both Moodle and Canvas activation.
- Live Moodle Web Services execution against sandbox/tenant credentials.
- Live Canvas REST/OAuth/SIS Import execution against sandbox/tenant credentials.
- Durable provider job queue or worker runner with replay/idempotency.
- Activation UI and validation checks for provider status transitions.
- Evidence artifacts proving launch, course shell sync, roster sync, grade/progress return, reconciliation, error handling, secret redaction, and rollback.

## Council Agent Findings

### Agent 1 — Architecture

The provider-neutral contract remains the right boundary. Moodle and Canvas must not become separate product branches. Both providers should implement the same operation families:

- provider credential validation
- launch URL creation
- course shell provisioning
- roster membership sync
- grade return reviewed import
- progress return reviewed import
- reconciliation report
- provider health and circuit state

The worker should execute provider operations outside SSR request handlers. UI routes may enqueue or request status, but the transport layer belongs in `src/modules/lms-contract`.

### Agent 2 — Security And Privacy

Provider secrets are the gating risk. Canvas OAuth tokens, Canvas developer-key secrets, Moodle Web Service tokens, Moodle launch secrets, webhook signatures, and raw provider payloads must stay out of:

- browser responses
- Student PWA read models
- guardian read models
- official transcript records
- ShepherdAI signal payloads
- audit metadata
- logs

Acceptance must include automated secret-redaction tests and negative tests proving a compromised tenant cannot use another tenant's provider configuration.

### Agent 3 — Product And UX

Full integration means the institution admin can safely activate, pause, validate, and monitor each provider. Student launch should show a clear provider-specific action when available and a safe unavailable reason when the provider is inactive, misconfigured, paused, or circuit-open.

For MVP, avoid a broad visual integration dashboard. Build a focused settings surface with:

- provider status
- credential validation result
- last sync result
- circuit state
- activation checklist
- sandbox evidence links

### Agent 4 — Competitive Readiness

For SIS competitiveness, "supports Moodle and Canvas" is only credible if Academy can prove live operations:

- created or mapped course shells
- synced roster memberships
- returned grade/progress data without official-record auto-posting
- launched a student into the selected LMS
- reconciled expected vs observed provider state
- recovered from provider errors without leaking secrets

Canvas must receive the same rigor as Moodle. A Canvas "foundation only" posture is honest today but not competitive enough for a full SIS claim.

### Wildcard — Failure Mode Review

The most likely failure is false confidence from mocked adapter tests. The program must require sandbox-backed evidence before changing roadmap status to complete.

Wildcard requirements:

- Use provider sandboxes or tenant-provided test instances before production activation.
- Treat Canvas SIS batch mode as dangerous; require explicit change thresholds and disable destructive batch mode by default.
- Treat Moodle tokens as long-lived secrets; require rotation and pause behavior.
- Require network failure, auth failure, permission failure, stale mapping, duplicate job, and circuit-open tests for both providers.

## External Source Notes

Primary documentation checked:

- Canvas developer docs describe Canvas as a REST API with OAuth2 authentication, JSON responses, HTTPS, and recommended bearer-token authorization: https://developerdocs.instructure.com/services/canvas
- Canvas OAuth2 docs specify expiring access tokens, refresh tokens, developer keys, token-storage risk, and OAuth flow requirements: https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth
- Canvas SIS Imports API supports root-account SIS imports and documents import states, upload methods, and batch-mode behavior: https://developerdocs.instructure.com/services/canvas/resources/sis_imports
- Canvas SIS CSV docs describe users/courses/enrollments CSV import and caution that batch mode can delete courses, sections, and enrollments: https://developerdocs.instructure.com/services/canvas/sis/file.sis_csv
- Moodle web services docs require enabling web services/protocols, custom external services, selected functions, capabilities, and user-specific tokens: https://docs.moodle.org/502/en/Using_web_services
- Moodle web service client docs show REST calls through `/webservice/rest/server.php` with `wstoken`, `wsfunction`, and `moodlewsrestformat=json`: https://docs.moodle.org/dev/Creating_a_web_service_client

## Factory Decision

Proceed with ADR-0059.

Execution must follow:

1. docs-first factory intake
2. TDD for every operation family
3. provider-neutral contract conformance before provider-specific code
4. small PR slices with CI passing before merge
5. no provider status upgrade without sandbox evidence
6. no destructive Canvas SIS batch behavior by default
7. no official-record mutation from provider returns without Academy review

