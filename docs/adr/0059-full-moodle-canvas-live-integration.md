# ADR-0059 — Full Moodle And Canvas Live Integration Program

**Date:** 2026-06-26
**Status:** Accepted
**Deciders:** Ricardo Julia, Council Review XI
**Council review:** `docs/reviews/2026-06-26-council-review-11-full-lms-integration.md`

## Context

ChurchCore Academy already has a provider-neutral LMS contract, no-LMS mode, Moodle adapter decisions, Canvas configuration posture, Student PWA launch boundary, reviewed-import posture, and retry/circuit-breaker strategy. That foundation is not the same as full live integration.

Moodle requires enabled Web Services, selected protocols/functions, service-user permissions, and token-based REST calls to `/webservice/rest/server.php` with `wstoken`, `wsfunction`, and `moodlewsrestformat=json`. Canvas requires HTTPS REST API calls, OAuth2/developer-key token handling, SIS-aware identifiers, and, where SIS import is used, careful handling of SIS import state and destructive batch-mode options.

The product needs a single governing decision for full Moodle and Canvas parity so the roadmap does not overstate Canvas readiness or treat Moodle as production-live before activation evidence exists.

## Decision

ChurchCore Academy will complete Moodle and Canvas through one provider-neutral live integration program. Moodle and Canvas must implement the same Academy-owned operation families and pass the same acceptance matrix before either provider can be labeled production-ready.

### 1. Provider-neutral operation families

Both providers must support these operation families behind the existing LMS contract:

- `validateCredentials`
- `createOrUpdateCourseShell`
- `syncRosterMemberships`
- `createLaunchResponse`
- `importGradeReturnForReview`
- `importProgressReturnForReview`
- `runReconciliation`
- `readProviderHealth`
- `pauseProvider`
- `resumeProviderAfterValidation`

No Academy domain module may branch directly on Moodle or Canvas transport details. Course catalog, people, registrations, gradebook, transcripts, Student PWA, Guardian PWA, and ShepherdAI call provider-neutral services only.

### 2. Credential and configuration storage

Tenant provider configuration stores non-secret fields:

- tenant id
- provider id: `moodle` or `canvas`
- provider base URL
- enabled operation families
- launch mode
- selected account/root context
- activation status
- last validation result
- last successful operation timestamps
- circuit state summary

Secret material is stored only in the encrypted provider secret layer:

- Moodle Web Service token
- Moodle launch or LTI secrets
- Canvas OAuth client secret
- Canvas access token
- Canvas refresh token
- Canvas developer-key secrets
- webhook signatures
- private signing keys

Provider secrets must never appear in logs, audit metadata, browser responses, Student PWA models, guardian models, official records, reporting exports, or ShepherdAI inputs.

### 3. Moodle implementation

Moodle live integration uses a server-side `MoodleHttpClient` that:

- calls Moodle Web Services over HTTPS in production;
- sends `wstoken`, `wsfunction`, and `moodlewsrestformat=json`;
- maps Moodle exception-in-200 responses to provider errors;
- classifies genuine 4xx as non-retryable and 5xx/network failures as retryable;
- redacts token-shaped values from errors and audit events;
- implements course shell, roster, launch, grade return, progress return, and reconciliation operations through provider-neutral result types.

Moodle tenant activation is blocked until the tenant has enabled the required Web Services protocol, created an authorized service user/token, assigned least-privilege capabilities, and passed validation.

### 4. Canvas implementation

Canvas live integration uses a server-side `CanvasHttpClient` that:

- calls Canvas over HTTPS;
- uses OAuth2 bearer-token authorization for REST calls;
- stores and refreshes expiring tokens through the encrypted provider secret layer;
- supports SIS-aware identifiers where Canvas supports them;
- treats Canvas SIS Import as a separate high-risk operation with explicit confirmation and change thresholds;
- implements course shell, roster, launch, grade return, progress return, and reconciliation operations through provider-neutral result types.

Canvas tenant activation is blocked until the tenant has developer-key/OAuth configuration, authorized scopes, root account or course context configuration, sandbox validation, and successful token refresh evidence.

### 5. Worker execution and idempotency

Live provider operations run through a durable execution boundary, not directly in SSR page renders. UI actions may enqueue jobs, request latest status, or show validation results.

Every provider operation requires:

- tenant id
- provider id
- operation family
- provider-neutral payload
- idempotency key
- requested-by actor or system service actor
- correlation id

Duplicate jobs with the same idempotency key must not create duplicate LMS side effects or duplicate Academy reviewed-import records.

### 6. Grade and progress return boundary

Provider-returned grades and progress never directly post official Academy records. They create reviewed imports with:

- source provider
- provider reference id
- source timestamp
- normalized grade/progress value
- confidence/mapping status
- `reviewStatus: "pending_review"` unless explicitly rejected by validation

Only Academy review workflows may promote provider-returned data into official gradebook, transcript, Student PWA release, ShepherdAI signals, or compliance reports.

### 7. Reconciliation and activation evidence

Each provider must produce a reconciliation report comparing Academy expected state to provider observed state for:

- course shells
- sections
- instructor memberships
- student memberships
- launch mappings
- grade return mappings
- progress return mappings
- provider capabilities
- credential health

Roadmap status may move to "complete" only after sandbox-backed evidence exists for both Moodle and Canvas. Mocked conformance tests are necessary but not sufficient.

### 8. Error handling, retry, circuit breaker, and rollback

Both providers use the shared retry/circuit strategy from ADR-0046:

- retry only retryable provider/network failures;
- trip a tenant/provider circuit after repeated failures;
- avoid cascading LMS outages into Academy page renders;
- notify administrators through the communications queue;
- allow admin pause/resume after validation;
- support rollback by pausing provider workers without deleting Academy data.

### 9. Documentation and GitHub discipline

Implementation must be split into small PRs. Each PR must:

- reference ADR-0059;
- include tests for the operation family changed;
- update provider docs/runbooks if behavior changes;
- keep GitHub CI green before merge;
- avoid mixing unrelated refactors.

The final closeout must update:

- `docs/product/factory-roadmap.md`
- `docs/integrations/moodle-provider-configuration.md`
- `docs/integrations/canvas-provider-configuration.md`
- `docs/runbooks/provider-activation.md`
- a release/readiness note with sandbox evidence links or local evidence commands

## Consequences

Positive:

- Moodle and Canvas reach parity through one Academy-owned LMS contract.
- The Student PWA can launch provider courses without knowing provider secrets.
- Course, roster, grade, progress, and reconciliation workflows can be tested consistently across providers.
- Provider outages are isolated from core SIS workflows.
- The roadmap can truthfully claim full LMS integration only when evidence exists.

Negative:

- This is larger than a single small feature and must be split into slices.
- Canvas OAuth/token refresh and SIS import behavior adds more operational complexity than Moodle token calls.
- Provider sandboxes or tenant test instances are required for final readiness evidence.
- Credential rotation, provider pause/resume, and circuit recovery must be built before activation is credible.

## Alternatives Considered

### Moodle-first completion, Canvas later

Rejected as the governing strategy. It would improve Moodle faster but preserve a misleading "supports Canvas" posture. Moodle can still be implemented in an early slice, but the program must require Canvas parity before full LMS readiness is claimed.

### Canvas SIS CSV only

Rejected as the only Canvas integration model. SIS Import is useful for bulk provisioning but too risky for routine course/roster updates if destructive batch behavior is misconfigured. Direct REST operations and reviewed imports remain necessary.

### Provider-specific UI and workflows

Rejected. It would duplicate activation, launch, sync, audit, retry, reconciliation, and error handling. The existing provider-neutral contract is the correct boundary.

### Mock-only provider readiness

Rejected. Mocked tests are required for deterministic CI, but provider readiness also requires sandbox or tenant test evidence.

## Review Notes

- Product boundary: Academy remains the SIS, official-record, review, release, and Student PWA authority.
- LMS boundary: Moodle and Canvas are external delivery runtimes reached only through the LMS contract.
- Security/privacy: all provider secrets and raw provider payloads stay out of browser and domain records.
- Testing: provider-neutral conformance tests, provider HTTP client tests, idempotency tests, secret-redaction tests, cross-tenant rejection tests, and sandbox evidence are required.
- Rollback: pause the provider worker and mark the tenant provider `paused`; do not delete Academy records or reviewed imports.

## Related

- ADR-0014 — LMS Provider Contract And No-LMS Mode
- ADR-0015 — Moodle Adapter Integration Model
- ADR-0016 — Moodle Credential And Endpoint Storage Model
- ADR-0046 — LMS HTTP Client Implementation And Retry Strategy
- `docs/integrations/moodle-provider-configuration.md`
- `docs/integrations/canvas-provider-configuration.md`

