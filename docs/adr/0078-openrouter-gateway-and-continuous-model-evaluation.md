# ADR 0078: OpenRouter As The Only LLM Path, With Continuous Model Evaluation

Date: 2026-10-03
Status: accepted

## Context

Until now the only LLM call in Academy was `/api/ai`, which forwarded the HQ agent council's request body, including a client-chosen model and token budget, straight to `api.anthropic.com` with `ANTHROPIC_API_KEY`. Any signed-in user who could reach the route could spend the key on any model at any size, and nothing recorded what was spent.

ADR 0070 (proposed) already commits Academy to a shared OpenRouter subscription for future administrative wording assistance. The company now wants every AI feature on OpenRouter, starting with the HQ council, and wants the model chosen for each kind of request by an evaluation that keeps weighing quality against live pricing, not by a string hardcoded in a component.

## Decision

1. **One gateway.** `src/modules/ai-gateway/` is the only code allowed to call a model provider. Its `OpenRouterClient` is the only file that knows a provider URL. A test (`gateway-and-client.test.ts`) fails the build if any other source file references a provider host or SDK.
2. **No-retention routing.** Every request sets two separate OpenRouter provider controls. `data_collection: "deny"` excludes providers that may store or train on prompts. `zdr: true` restricts routing to Zero Data Retention endpoints, which don't retain prompts or completions after the request. A model with no ZDR endpoint fails its requests, so it fails evaluation and is never selected. Every request also asks for usage accounting (`usage.include`), so cost comes from OpenRouter rather than our own estimate.
3. **Task kinds ("asks"), not models.** Callers name a task kind, such as `hq_council_review`, `hq_reasoning`, `hq_engineering` or `hq_writing`, and the gateway resolves the model. Each kind has a profile in `task-profiles.ts` with quality/cost/latency weights, a quality floor, a per-request cost ceiling, typical token mix, and at least two synthetic evaluation cases. HQ agents map to kinds on the server, and the client can no longer choose a model or a token budget.
4. **Continuous evaluation.** The `/api/cron/ai-model-evaluation` cron runs every 6 hours and works as follows:
   - It loads OpenRouter's live catalog.
   - For each kind, it filters to recent, text-capable models from allow-listed providers under the cost ceiling whose completion limit covers the kind's full output ceiling.
   - It evaluates a few targets per run: a stale or incompletely covered incumbent first, then models missing a required case (a dropped grader sample is retried at once instead of waiting to go stale), then never-tested models (newest first), then the stalest results.
   - A configurable grader model scores each answer blind against a rubric. The grader score is combined with deterministic checks (required terms, length).
   - A model qualifies only with a sample (graded or failed) for every case of the kind; repeated samples of one case don't substitute for another.
   - It ranks models by `fit = wq·quality + wc·cost + wl·latency`. Cost is recomputed from *today's* prices, so a price change re-ranks models without re-testing them.
   - A challenger replaces the incumbent only when it wins by a 0.02 margin, which prevents flapping. The next two models become OpenRouter fallbacks.
   - Runs stop at a USD budget (`AI_EVAL_RUN_BUDGET_USD`, default $0.50) and a time deadline sized to a 300-second function. The budget is a hard cap: before a job starts, the run reserves its worst case (prompts bounded at one token per UTF-8 byte, every answer at the full output limit, and the graded answer cut to 16,000 UTF-8 bytes, so it costs the grader at most 16,000 tokens however the candidate tokenized it). A call that fails, times out, or reports no usage is charged at its worst case, never zero. A job that is blocked only by other jobs' in-flight reservations waits for them to finish. A job that can't fit even on its own is skipped, and cheaper jobs behind it still run. Models whose worst case can never fit a run's budget are left out of planning, so they never take a slot from affordable models. Reservations are recorded before a job starts, so concurrent workers can't over-commit. The catalog request times out after 30s.
   - A run's summary, evaluations, and selections are written in one transaction at the end, so a failure never leaves evaluations or a live selection without their run.
   - If nothing qualifies, an incumbent that is still eligible keeps serving. One that left the catalog, is expiring, or is now over the price ceiling is replaced by the cold-start route.
   - Only one run happens at a time. The cron and the admin trigger share a single-row lease (`academy_ai_evaluation_lease`) that expires on its own if a run dies. A blocked admin trigger gets a 409, and a blocked cron tick reports `skipped`.
5. **Cold start.** Until a model qualifies for a kind, requests go to `openrouter/auto`.
6. **Metering.** Every gateway call produces exactly one usage record. The gateway assigns its id before the first write, so a retry after a lost acknowledgement is ignored as a duplicate (`on conflict (id) do nothing`). The record holds: kind, served model, tokens, OpenRouter-reported cost, latency and status. A stream that the client abandons, errors upstream, or exceeds the ask's timeout is recorded as `failed`. A usage write is retried twice (100 ms, then 500 ms). If the database is still unavailable, the request still succeeds, and the record (counts and cost only) goes to the server log as `ai_gateway_usage_unrecorded` for reconciliation instead of being dropped. OpenRouter's own activity log remains the billing source of truth. Each provider call is bounded by its ask's timeout. Each gateway database call (the selection read and each usage-write attempt) is bounded at 2s, so a stalled database falls back to the auto-router or hands off the usage record instead of holding the request. A conversation estimated (at about 3 UTF-8 bytes per token) not to fit the ask's guaranteed context window, after reserving its output ceiling, is rejected with 413 before any provider call. The estimate is deliberately not a strict bound, so a borderline request that still overflows surfaces as the provider's error. Prompts and completions are never stored. Evaluation rows keep only a 2,000-character excerpt of answers to *synthetic* prompts, for human spot-checks.
7. **Visibility.** HQ → AI Models shows each kind's routed model, fallbacks, reason, leaderboard, 60-day spend, and recent runs. Platform admins can trigger a run; the button is shown only to them. In the agent chat, HQ shows the model that actually answered, read from the SSE chunks. The `x-ai-route` response header names only the requested route, which may be the auto-router or a primary that fell back.
8. **Append-only history.** Evaluation runs, evaluations, and selections reject `UPDATE` and `DELETE` at the database through triggers, so routing history cannot be rewritten.
9. **Access.** `/api/ai` and the AI Models report require platform staff. Triggering an evaluation requires platform admin.

## Consequences

- Swapping models is now a data change made by the evaluator, not a code change. Price drops and new releases are picked up within days, without a deploy.
- The evaluator costs money. At defaults, the ceiling is about $2 a day. In steady state, once the eligible pool has been tested, runs only re-test stale or new models and spend far less.
- The grader model is excluded from competing for the kinds it judges, to avoid self-preference bias. To let it compete, configure a different grader.
- Grader scores are a proxy for quality. The leaderboard and stored excerpts exist so a human can check that the proxy matches judgment, and task profiles' cases and weights are expected to evolve.
- HQ is now platform-staff-only on the AI path. Signed-in users without a platform role can still open HQ but cannot call the agents.
- Adding an AI feature now means adding a task kind and profile and calling `AiGateway`. Any feature touching student data still requires ADR 0070's anonymization pipeline and council sign-off before it ships. This ADR does not relax that.

## Alternatives Considered

- **Keep a direct Anthropic integration:** rejected. It is a single provider with no price competition, and it conflicts with ADR 0070's shared OpenRouter direction.
- **Only use `openrouter/auto`:** rejected as the steady state. Its choice isn't tuned to our asks, our quality bar, or our cost weights, and it gives us no evidence. It is kept as the cold-start route.
- **Quarterly manual evaluation (ADR 0070's original plan):** superseded by the continuous evaluator, which still produces the same comparison table on demand.

## Configuration

`OPENROUTER_API_KEY` (required), `OPENROUTER_APP_URL`, `OPENROUTER_BASE_URL` (e2e stub only; never set it in a deployed environment), `AI_EVAL_GRADER_MODEL` (default `anthropic/claude-sonnet-5.5`), `AI_EVAL_RUN_BUDGET_USD`, `AI_EVAL_MODELS_PER_TASK` (a whole number of at least 1; anything else falls back to the default), `AI_EVAL_PROVIDER_PREFIXES`, `CRON_SECRET`.

## Rollback

Unset `OPENROUTER_API_KEY`: AI routes return 503 and the cron reports `disabled`. To pin a model, insert a row into `academy_ai_model_selections`. The newest row per kind wins until the evaluator finds a better model by the switch margin.
