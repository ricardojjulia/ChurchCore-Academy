# Full Moodle And Canvas Integration AI Prompts

**Date:** 2026-06-26
**Governing ADR:** `docs/adr/0059-full-moodle-canvas-live-integration.md`
**Council review:** `docs/reviews/2026-06-26-council-review-11-full-lms-integration.md`
**Design spec:** `docs/superpowers/specs/2026-06-26-full-lms-integration-design.md`

## Operating Rules For Every Agent

You are working in ChurchCore Academy. Follow the software factory:

1. Create or use an isolated git worktree/branch for the slice.
2. Read ADR-0059, ADR-0014, ADR-0016, ADR-0046, the design spec, and the relevant provider configuration doc before editing.
3. Use TDD: write the failing test first, run it, implement the smallest change, rerun.
4. Keep provider secrets out of browser responses, logs, audit metadata, Student PWA models, guardian models, official records, and ShepherdAI inputs.
5. Keep provider-specific transport code inside `src/modules/lms-contract`.
6. Do not mutate official grades/transcripts from provider returns; create reviewed imports only.
7. Commit a focused branch and open/update a PR with verification evidence.
8. Do not merge until CI passes.

Recommended local verification:

```bash
npm test
npm run lint
npm run build
git diff --check
```

## Slice A — Shared Provider Activation And Secret Boundary

```text
You are implementing Slice A of ADR-0059 for ChurchCore Academy: shared Moodle/Canvas provider activation and secret boundary.

Read:
- docs/adr/0059-full-moodle-canvas-live-integration.md
- docs/adr/0014-lms-provider-contract-and-no-lms-mode.md
- docs/adr/0016-moodle-credential-and-endpoint-storage-model.md
- docs/adr/0046-lms-http-client-implementation-retry-strategy.md
- docs/superpowers/specs/2026-06-26-full-lms-integration-design.md

Goal:
Create the tenant-scoped provider configuration and encrypted-secret access boundary required before live Moodle or Canvas calls can run.

Required implementation:
1. Add provider configuration types for Moodle and Canvas with non-secret fields only.
2. Add a server-side provider secret resolver abstraction that can be mocked in tests.
3. Add validation service methods:
   - validateProviderConfigShape(providerConfig)
   - assertProviderCanActivate(providerConfig, validationResult)
   - redactProviderSecretShape(value)
4. Add migration(s) only if the repo does not already have suitable provider config/secret tables.
5. Add tests proving:
   - Moodle and Canvas configs accept base URL, provider status, launch mode, enabled operations, and account/context metadata.
   - secret-shaped fields are rejected from non-secret config.
   - secret redaction removes tokens, client secrets, refresh tokens, private keys, webhook secrets, and authorization headers.
   - cross-tenant provider config reads/writes are rejected.
6. Update docs/integrations/moodle-provider-configuration.md and docs/integrations/canvas-provider-configuration.md with activation prerequisites.

Verification:
- Run focused tests for the new provider config/secret modules.
- Run npm test, npm run lint, npm run build, git diff --check.

GitHub discipline:
- Commit as: "Add LMS provider activation boundary"
- Push a branch named feature/lms-provider-activation-boundary.
- Open a PR referencing ADR-0059 and include test output.
```

## Slice B — Moodle Live HTTP Operations

```text
You are implementing Slice B of ADR-0059: Moodle live HTTP operations.

Read:
- docs/adr/0059-full-moodle-canvas-live-integration.md
- docs/adr/0015-moodle-adapter-integration-model.md
- docs/adr/0016-moodle-credential-and-endpoint-storage-model.md
- docs/adr/0046-lms-http-client-implementation-retry-strategy.md
- docs/integrations/moodle-provider-configuration.md

Primary external constraint:
Moodle Web Services REST calls use /webservice/rest/server.php with wstoken, wsfunction, and moodlewsrestformat=json. Moodle exception payloads may arrive with HTTP 200 and must be normalized as provider errors.

Goal:
Implement Moodle live transport behind the existing LMS contract without exposing Moodle secrets.

Required implementation:
1. Implement or complete MoodleHttpClient under src/modules/lms-contract.
2. Support request helpers for:
   - core_course_get_courses_by_field
   - enrol_manual_enrol_users
   - gradereport_user_get_grade_items
   - any existing Moodle course/roster/progress functions already modeled in the contract
3. Map Moodle responses into provider-neutral operation results.
4. Add retry classification:
   - Moodle exception payload: non-retryable unless explicitly transient.
   - HTTP 4xx: non-retryable.
   - HTTP 5xx/network error: retryable.
5. Redact tokens and raw provider payloads from thrown errors and audit metadata.
6. Add tests proving success mapping, exception-in-200 mapping, retry classification, token redaction, and idempotency behavior.
7. Update Moodle provider docs with exact required Moodle Web Service setup steps and least-privilege capability checklist.

Verification:
- Run focused Moodle HTTP/client/adapter tests.
- Run npm test, npm run lint, npm run build, git diff --check.

GitHub discipline:
- Commit as: "Implement Moodle live LMS transport"
- Push a branch named feature/moodle-live-lms-transport.
- Open a PR referencing ADR-0059 and include test output.
```

## Slice C — Canvas Live HTTP, OAuth, And SIS-Safe Operations

```text
You are implementing Slice C of ADR-0059: Canvas live HTTP, OAuth/token refresh, and SIS-safe operations.

Read:
- docs/adr/0059-full-moodle-canvas-live-integration.md
- docs/adr/0046-lms-http-client-implementation-retry-strategy.md
- docs/integrations/canvas-provider-configuration.md
- docs/superpowers/specs/2026-06-26-full-lms-integration-design.md

Primary external constraints:
Canvas uses HTTPS REST APIs with OAuth2 bearer-token authentication. Developer-key tokens issued after Oct 2015 expire and require refresh tokens. Canvas SIS Import supports bulk import but batch mode can delete courses, sections, and enrollments, so destructive batch behavior must be disabled by default.

Goal:
Implement Canvas live transport and token refresh behind the existing LMS contract.

Required implementation:
1. Implement or complete CanvasHttpClient under src/modules/lms-contract.
2. Support Authorization: Bearer token headers.
3. Add token refresh flow through the provider secret resolver; never store refreshed tokens in ordinary Academy domain tables.
4. Implement direct REST operations for course shell, roster, launch support, grade return, progress return, and reconciliation where the existing contract supports them.
5. Treat Canvas SIS Import as an explicit, high-risk operation:
   - disabled by default;
   - no batch mode unless config explicitly enables it;
   - require change_threshold when batch mode is enabled;
   - record import id/status for reconciliation.
6. Add tests proving token refresh, 401 handling, 403 permission errors, pagination handling if used, secret redaction, cross-tenant rejection, SIS batch-mode guardrails, and provider-neutral result mapping.
7. Update Canvas provider docs with OAuth/developer-key setup, required scopes, sandbox activation, and SIS batch guardrails.

Verification:
- Run focused Canvas HTTP/client/adapter tests.
- Run npm test, npm run lint, npm run build, git diff --check.

GitHub discipline:
- Commit as: "Implement Canvas live LMS transport"
- Push a branch named feature/canvas-live-lms-transport.
- Open a PR referencing ADR-0059 and include test output.
```

## Slice D — Durable LMS Worker, Idempotency, Retry, And Circuit Breaker

```text
You are implementing Slice D of ADR-0059: durable LMS worker execution, idempotency, retry, and circuit breaker.

Read:
- docs/adr/0059-full-moodle-canvas-live-integration.md
- docs/adr/0046-lms-http-client-implementation-retry-strategy.md
- docs/adr/0019-immutable-audit-events-and-outbox-boundary.md

Goal:
Move live LMS side effects into a durable execution boundary that can safely retry and can be paused per tenant/provider.

Required implementation:
1. Add or complete LMS job persistence with tenant id, provider id, operation family, payload, idempotency key, requested-by actor, correlation id, status, attempts, last error, and timestamps.
2. Add worker service methods:
   - enqueueLmsOperation(input)
   - runNextLmsOperation(workerContext)
   - runDueLmsOperations(workerContext, limit)
   - markProviderCircuitOpen(tenantId, provider, reason)
   - resetProviderCircuitAfterSuccess(tenantId, provider)
3. Ensure duplicate idempotency keys do not create duplicate side effects.
4. Ensure circuit-open tenants skip provider calls and produce safe audit events.
5. Add admin notification through the communications queue when a circuit opens.
6. Add tests for duplicate jobs, retry exhaustion, circuit open skip, successful reset, audit-safe metadata, and cross-tenant rejection.

Verification:
- Run focused LMS worker tests.
- Run npm test, npm run lint, npm run build, git diff --check.

GitHub discipline:
- Commit as: "Add durable LMS execution worker"
- Push a branch named feature/lms-execution-worker.
- Open a PR referencing ADR-0059 and include test output.
```

## Slice E — Student Launch, Reviewed Imports, And Reconciliation Parity

```text
You are implementing Slice E of ADR-0059: Student PWA launch, reviewed imports, and Moodle/Canvas reconciliation parity.

Read:
- docs/adr/0059-full-moodle-canvas-live-integration.md
- docs/adr/0013-student-pwa-data-exposure-model.md
- docs/adr/0055-student-pwa-full-self-service.md
- docs/integrations/moodle-provider-configuration.md
- docs/integrations/canvas-provider-configuration.md

Goal:
Complete the user-visible and staff-review boundaries for live LMS operations without exposing provider internals.

Required implementation:
1. Ensure /api/academy/student/lms/launch works for active Moodle and Canvas tenants through the provider-neutral orchestration path.
2. Ensure unavailable states are safe and specific:
   - no LMS selected
   - provider inactive
   - provider paused
   - credentials invalid
   - circuit open
   - course mapping missing
3. Ensure launch responses include only safe fields: availability, display label, launch URL, expiry, audit reference, safe reason.
4. Ensure grade/progress returns create reviewed imports only.
5. Ensure reconciliation reports include Moodle and Canvas parity fields:
   - expected course shells
   - observed course shells
   - roster drift
   - grade return drift
   - progress return drift
   - capability drift
   - credential health
6. Add tests proving Student PWA secret exclusion, guardian boundary preservation, reviewed-import-only behavior, reconciliation parity, and safe unavailable reasons.

Verification:
- Run focused Student PWA LMS launch and reconciliation tests.
- Run npm test, npm run lint, npm run build, git diff --check.

GitHub discipline:
- Commit as: "Complete LMS launch and reconciliation parity"
- Push a branch named feature/lms-launch-reconciliation-parity.
- Open a PR referencing ADR-0059 and include test output.
```

## Slice F — Activation UI, Runbooks, Sandbox Evidence, And Release Closeout

```text
You are implementing Slice F of ADR-0059: activation UI, runbooks, sandbox evidence, and release closeout.

Read:
- docs/adr/0059-full-moodle-canvas-live-integration.md
- docs/runbooks/provider-activation.md
- docs/product/factory-roadmap.md
- docs/integrations/moodle-provider-configuration.md
- docs/integrations/canvas-provider-configuration.md

Goal:
Make full Moodle and Canvas readiness auditable and truthful.

Required implementation:
1. Add an admin provider settings surface or extend the existing settings surface with:
   - provider selection
   - activation status
   - validation status
   - circuit state
   - last successful sync
   - last failed sync
   - sandbox evidence links or local evidence command output references
   - pause/resume actions guarded by role checks
2. Add provider activation runbook updates for Moodle and Canvas.
3. Add a release/readiness note documenting:
   - Moodle sandbox validation evidence
   - Canvas sandbox validation evidence
   - tests run
   - known limitations
   - rollback procedure
4. Update docs/product/factory-roadmap.md to mark Moodle and Canvas live integration status truthfully based on evidence.
5. Add smoke tests or route tests for activation UI role boundaries.
6. Do not mark full LMS integration complete unless sandbox evidence exists for both providers.

Verification:
- Run focused activation UI/route tests.
- Run npm test, npm run lint, npm run build, git diff --check.

GitHub discipline:
- Commit as: "Close out full LMS integration readiness"
- Push a branch named feature/lms-integration-readiness-closeout.
- Open a PR referencing ADR-0059 and include test output plus evidence links.
```

## Single Master Execution Prompt

```text
You are Codex working in /Users/rjulia/ChurchCore Academy. Execute the full Moodle and Canvas live integration program using the ChurchCore Academy software factory, documentation discipline, and GitHub discipline.

Governance:
- Read docs/reviews/2026-06-26-council-review-11-full-lms-integration.md.
- Read docs/adr/0059-full-moodle-canvas-live-integration.md.
- Read docs/superpowers/specs/2026-06-26-full-lms-integration-design.md.
- Read docs/prompts/2026-06-26-full-lms-integration-prompts.md.
- Read ADR-0014, ADR-0016, ADR-0019, and ADR-0046 before touching code.
- Use official Moodle and Canvas docs for provider behavior when uncertain. Prefer primary docs over memory or guesses.

Execution discipline:
1. Start clean from origin/main.
2. Create one isolated worktree/branch per slice.
3. Execute slices in order: A provider activation boundary, B Moodle live transport, C Canvas live transport, D durable worker, E launch/import/reconciliation parity, F activation UI/runbook/release closeout.
4. For each slice, use TDD:
   - write failing tests first;
   - run the focused tests and confirm failure;
   - implement the smallest code/doc change;
   - rerun focused tests;
   - run npm test, npm run lint, npm run build, git diff --check.
5. Commit each slice with a focused commit message.
6. Push each slice branch and open a PR against main.
7. Wait for GitHub CI to pass before merging.
8. Pull main before starting the next slice.
9. Do not let multiple agents edit the same branch at the same time.

Architecture boundaries:
- Academy remains the SIS, official-record, review, release, and Student PWA authority.
- Moodle and Canvas are external delivery runtimes.
- Provider-specific transport code belongs under src/modules/lms-contract.
- Student PWA and Guardian PWA never receive provider tokens, raw payloads, or unsafe errors.
- Provider grade/progress return creates reviewed imports only.
- No official grade, transcript, ShepherdAI signal, compliance report, or Student PWA released record may change from provider data without Academy review.
- Canvas destructive SIS batch behavior is disabled by default and requires explicit config plus change thresholds.

Documentation discipline:
- Update provider docs when provider setup changes.
- Update runbooks when activation, rollback, or operations change.
- Update docs/product/factory-roadmap.md only when evidence supports the status.
- Add release/readiness evidence before claiming full LMS integration is complete.

GitHub discipline:
- Every PR references ADR-0059.
- Every PR includes test output.
- Every PR is small enough to review.
- No PR merges with failing CI.
- After each merge, delete the branch and clean stale worktrees.

Completion definition:
Full LMS integration is complete only when both Moodle and Canvas have:
- credential validation;
- live sandbox or tenant-test HTTP evidence;
- launch support;
- course shell sync;
- roster sync;
- grade return reviewed import;
- progress return reviewed import;
- reconciliation;
- retry/circuit behavior;
- secret-redaction tests;
- cross-tenant tests;
- activation/rollback runbook;
- green GitHub CI.
```

