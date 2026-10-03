# Council Review 24 - OpenRouter AI Gateway And Continuous Model Evaluation

Date: 2026-10-03
Branch: `feature/ai-openrouter-gateway` (PR #218)
Scope: current diff. In scope: the `ai-gateway` module, the `/api/ai`, `/api/academy/platform/ai-models`, and `/api/cron/ai-model-evaluation` routes, the HQ AI Models view and agent chat, two migrations, the e2e OpenRouter stub and journey, and ADR 0078.
Decision requested: ship / revise / defer / split / reject

## Executive Verdict

Decision: **revise -> fixed locally**
Release status: not merged, deployed, or externally validated. Enabling the gateway in any hosted environment requires an OpenRouter key, `CRON_SECRET`, and owner approval of the evaluator spend ceiling.

All model calls now go through one gateway that routes each internal HQ ask to an evaluated model. Routing is zero-retention, and every call is metered. The slice adds no customer-facing or student-data AI surface.

This Council ran after seven rounds of automated PR review. It found a small set of real UX, error-handling, test-evidence, and documentation gaps, and no architecture, data, or security defects.

## Council Findings

### Architecture And Data

The verdict is ship, with no findings.
- Business logic lives in `src/modules/ai-gateway/`. Routes resolve the actor, call the module, and map errors.
- `process.env` is resolved only in `src/lib/ai-gateway.ts`.
- All five tables are platform-level, with forced RLS and no anon or authenticated grants.
- Routing history (runs, evaluations, selections) rejects `UPDATE` and `DELETE` through triggers.
- A single-row expiring lease serializes evaluation runs.
- Each run's summary, evaluations, and selections are written in one transaction.

### Security And Privacy

The verdict is ship, with no findings.
- `/api/ai` and the report require platform staff. Running an evaluation requires platform admin. Roles come from the verified session and persisted assignments, never from headers.
- The cron route checks its secret with `timingSafeEqual`.
- The API key is never logged or returned, and tests assert that secrets and database errors don't leak.
- Every request sets `zdr: true` and `data_collection: "deny"`.
- No tenant, student, prompt, or completion data is stored. Evaluation excerpts come only from synthetic cases.
- ADR 0070's anonymization requirement doesn't apply, because no student-data feature is added.

### Routes And API

The Routes/API voice reported the e2e manifest as listing the wrong persona for the platform routes. Product/Competitive repeated the claim.
- **Rejected.** The `institutionAdmin` e2e persona (`admin@churchcore.academy`) holds `platform_admin` through `supabase/migrations/20260616093000_seed_demo_persona_accounts.sql`. The CI sweep and journeys pass with that persona.
- **Accepted and fixed.** A run that can't grade (the configured grader model is missing from the catalog) returned HTTP 500 with a `{ summary }` body. The HQ page then showed a generic error. The route now returns an explanatory error, and a test covers it.

### UX And Accessibility

**Accepted and fixed:**
- No loading state while the model report loads.
- Errors weren't announced to screen readers.
- The selected model row had no semantic marker.
- The chat textarea relied on its placeholder as its only label.

The fixes are a `role="status"` loading line, `role="alert"` on the error box, `aria-current` on the selected row, and an agent-specific `aria-label`.

**Rejected:**
- A color-only warning: the warning text states the condition.
- Mixed cost precision: totals use 2 decimals and per-request costs use 4, on purpose.

**Out of scope:** the decorative search and notification controls predate this PR.

**Reclassified after verification.** The UX voice reported "undifferentiated" 403/409/503 errors. Synthesis first rejected that finding: `readResponseError` displays the `x-ai-error-message` header, and the chat route sets it. The new real-Postgres lease journey then failed in CI. It showed a 409 rendered as "AI request failed." The platform routes return `{ error }` through `jsonError` without that header, and the page's `getErrorMessage` read only `.message`. Every platform-route error in HQ had been shown as a generic message. The finding was correct. The page now reads `error`, and the journey asserts the specific 409 message in the HQ error box.

### Product And Competitive

This is platform infrastructure for an internal tool, outside the P0/P1 customer backlog. It doesn't conflict with ShepherdAI rules. HQ is an internal agent council for platform staff, and no customer or student surface receives LLM output.

**Accepted and fixed:**
- The CHANGELOG had no entry.
- The development guide didn't mention the gateway. It now notes the gateway under Current Product Status, and the deployment-approval list now includes OpenRouter key provisioning and the evaluator spend ceiling.

**Rejected, already covered:**
- Rollback and model pinning are documented in ADR 0078.
- An incumbent that becomes ineligible is replaced (review round 3).
- ADR 0078 already requires ADR 0070's pipeline for student-data features.

**Deferred:** a dedicated AI-gateway operations runbook covering cost alerting, manual pinning, and forward repair. Track it before hosted enablement.

### Testing Council

Unit and route coverage is broad. It covers:
- catalog and eligibility
- scoring and qualification
- selection hysteresis, the below-floor and ineligible incumbent cases, and the cold start
- budget reservation, scheduling, and the reservation race
- the lease, atomic finalize, idempotent and retried metering, and stream cancel, error, and timeout
- context admission
- route status mapping

**Accepted and fixed:** the lease had only been exercised against an in-memory repository and a fake pool. A browser journey now covers it against real Postgres:
- with a live lease held, the admin's run gets a 409 that the page displays through `role="alert"`, and the holder is unchanged;
- after the lease expires without release, the next run takes it over, completes, and releases it.

**Rejected:**
- "No cron route test": `src/app/api/cron/ai-model-evaluation/route.test.ts` covers a missing, wrong, or empty secret, a disabled key, a successful run, a 500 when the grader is missing, and a skip while the lease is held.
- "Postgres boundary values": the excerpt is cut to 2,000 characters before insert, and the rationale column has no length constraint.

Equivalent of cross-tenant proof: these tables are platform-level, not tenant-scoped. The equivalent is denied-role proof, which covers a registrar being denied the report, the run, and the chat in both the browser and the API.

## Verification

- Focused module and route tests: passed.
- `npm run verify`: passed, with 2,149 tests, lint, and build.
- `npm run verify:governance` and `git diff --check`: passed.
- `npm run test:full` (CI): passed on pre-Council head `1e15e27` in 22m50s, with all AI journeys green. The final head is verified by protected PR checks.
- Local `pr-review`: PASS, with 0 critical, 0 important, and 0 minor findings.
- Exact gate outcomes are in `docs/reports/factory-run-openrouter-ai-gateway-2026-10-03.md`.

## Residual Risk

- `zdr: true` can shrink the pool of models that can serve each ask. A model with no ZDR endpoint fails evaluation and is never selected.
- Grader scores are a proxy for quality. The leaderboard and stored excerpts exist so a person can check that the proxy matches their judgment.
- A usage write that still fails after retries is logged for reconciliation, not stored. OpenRouter's activity log remains the billing source of truth.
- Live OpenRouter behavior was checked manually (two runs, $0.56) before the review hardening. Later changes are verified against the deterministic stub, not the live API.

## Decision

Council decision is **revise -> fixed locally**. Proceed through `pr-review` and protected PR delivery. This decision doesn't authorize deployment, hosted enablement, or any student-data AI feature.
