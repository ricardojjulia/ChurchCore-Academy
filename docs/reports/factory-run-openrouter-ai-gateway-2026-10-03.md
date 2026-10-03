# Factory Run: OpenRouter AI Gateway And Continuous Model Evaluation

Date: 2026-10-03
Status: verified, pending PR delivery
PR: `#218`

## Intent

Route every LLM call in Academy through one OpenRouter gateway. Each ask is served by the model with the best evaluated balance of quality, live price, and latency, with zero-retention routing and per-call metering. This replaces the direct Anthropic integration, which let any signed-in user choose any model and token budget, and wasn't metered.

## Boundaries

- Internal HQ agent council only, for platform staff. No customer-facing, student-facing, or student-data AI surface is added.
- ShepherdAI remains a deterministic signal engine. No chatbot UI is exposed to institutions, students, or guardians.
- ADR 0070's anonymization pipeline and separate Council approval are still required before any student-data feature uses the gateway.
- No deployment or hosted enablement. The OpenRouter key, `CRON_SECRET`, and evaluator spend ceiling need owner approval.

## Implementation

- `src/modules/ai-gateway/`:
  - the OpenRouter client: the only provider URL, ZDR plus no data collection, timeouts on every call
  - task profiles for four HQ asks
  - catalog normalization and eligibility
  - blind grading and scoring, with qualification only on full case coverage
  - selection with switch-margin hysteresis and cold-start fallback
  - a budget-capped, lease-serialized evaluation runner with worst-case reservations and atomic finalize
  - the gateway, with context admission, exactly-once idempotent metering, and stream cancel, error, and timeout handling
  - the Postgres repository
- Routes:
  - `/api/ai`, rewritten to be platform-staff-only and server-routed
  - `/api/academy/platform/ai-models`: the report for platform staff and the run trigger for platform admins
  - `/api/cron/ai-model-evaluation`, run every 6 hours
- HQ:
  - the AI Models view, with routing, leaderboards, spend, runs, and an admin-only run action
  - the agent chat shows the model that answered, read from the stream
- Migrations `20261003090000` (tables, RLS, grants) and `20261003120000` (append-only triggers and the evaluation lease).
- e2e: a deterministic local OpenRouter stub wired into `npm run test:full`, plus the `ai-model-routing` journeys.
- Accepted ADR 0078. ADR 0070 is annotated to point to it.

## Verification

- Live check against the real OpenRouter API before the review rounds: two runs, $0.56. Grading, cost reporting, selection, and streaming worked.
- Automated PR review: seven Copilot rounds. 22 threaded findings and 13 summary-level findings were fixed, or triaged with a reply or comment. Every thread is resolved.
- Council Review 24 (`docs/reviews/2026-10-03-council-review-24-openrouter-ai-gateway-synthesis.md`): revise -> fixed locally.
- `npm run verify` on the Council code: passed (2,149 tests, lint, and build).
- Final code: `npm test` (2,152 tests), lint, `tsc --noEmit`, `verify:governance`, and `git diff --check` pass locally. The local `next build` can't run on this shared volume: Turbopack can't sync its cache files there (os error 25). The CI "Test, lint, and build" job is the build of record for the final head.
- `npm run test:full` (CI E2E job) on the pre-Council head `1e15e27`: passed in 22m50s. The final head, which adds the real-Postgres lease journey, is verified by the protected PR checks.
- `npm run verify:governance`: passed.
- `git diff --check`: passed.
- Local `pr-review` on the Council diff: PASS, with 0 critical, 0 important, and 0 minor findings.
- CI E2E on Council head `cbe14fd` failed on the new lease journey. That journey caught a real defect: HQ showed every platform-route error (`{ error }` bodies) as "AI request failed." The defect is fixed, the journey asserts the specific 409 message, and the Council synthesis is corrected.
- Copilot review of `cbe14fd`: four summary-level findings, all fixed with tests:
  - a run that can't grade still retires ineligible incumbents
  - rationale-only changes are recorded as new selection snapshots
  - route reads and usage writes have per-attempt database timeouts
- Remaining gates: protected PR checks on the final head, and Copilot review.

## Residual Risk

- ZDR routing may shrink the pool of models that can serve each ask.
- Grader scores are a proxy for quality, and humans spot-check them through stored excerpts.
- A usage write that fails after retries is logged, not stored. OpenRouter's activity log remains the billing source of truth.
- An AI-gateway operations runbook (cost alerting, manual pinning, forward repair) is deferred and must exist before hosted enablement.
