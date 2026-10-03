# ADR 0078: OpenRouter As The Only LLM Path, With Continuous Model Evaluation

Date: 2026-10-03
Status: accepted

## Context

Until now the only LLM call in Academy was `/api/ai`, which forwarded the HQ agent council's request body, including a client-chosen model and token budget, straight to `api.anthropic.com` with `ANTHROPIC_API_KEY`. Any signed-in user who could reach the route could spend the key on any model at any size, and nothing recorded what was spent.

ADR 0070 (proposed) already commits Academy to a shared OpenRouter subscription for future administrative wording assistance. The company now wants every AI feature on OpenRouter, starting with the HQ council, and wants the model chosen for each kind of request by an evaluation that keeps weighing quality against live pricing, not by a string hardcoded in a component.

## Decision

1. **One gateway.** `src/modules/ai-gateway/` is the only code allowed to call a model provider. Its `OpenRouterClient` is the only file that knows a provider URL. A test (`gateway-and-client.test.ts`) fails the build if any other source file references a provider host or SDK.
2. **No-retention routing.** Every request sets OpenRouter's `provider.data_collection: "deny"`, so OpenRouter never routes to a provider that retains or trains on prompts. Every request also asks for usage accounting (`usage.include`), so cost comes from OpenRouter rather than our own estimate.
3. **Task kinds ("asks"), not models.** Callers name a task kind, such as `hq_council_review`, `hq_reasoning`, `hq_engineering` or `hq_writing`, and the gateway resolves the model. Each kind has a profile in `task-profiles.ts` with quality/cost/latency weights, a quality floor, a per-request cost ceiling, typical token mix, and at least two synthetic evaluation cases. HQ agents map to kinds on the server, and the client can no longer choose a model or a token budget.
4. **Continuous evaluation.** The `/api/cron/ai-model-evaluation` cron runs every 6 hours and works as follows:
   - It loads OpenRouter's live catalog.
   - For each kind, it filters to recent, text-capable models from allow-listed providers under the cost ceiling.
   - It evaluates a few targets per run: a stale incumbent first, then never-tested models (newest first), then the stalest results.
   - A configurable grader model scores each answer blind against a rubric. The grader score is combined with deterministic checks (required terms, length).
   - It ranks models by `fit = wq·quality + wc·cost + wl·latency`. Cost is recomputed from *today's* prices, so a price change re-ranks models without re-testing them.
   - A challenger replaces the incumbent only when it wins by a 0.02 margin, which prevents flapping. The next two models become OpenRouter fallbacks.
   - Runs stop at a USD budget (`AI_EVAL_RUN_BUDGET_USD`, default $0.50) and a time deadline sized to a 300-second function.
5. **Cold start.** Until a model qualifies for a kind, requests go to `openrouter/auto`.
6. **Metering.** Every gateway call writes one usage row: kind, served model, tokens, OpenRouter-reported cost, latency and status. Prompts and completions are never stored. Evaluation rows keep only a 2,000-character excerpt of answers to *synthetic* prompts, for human spot-checks.
7. **Visibility.** HQ → AI Models shows each kind's routed model, fallbacks, reason, leaderboard, 60-day spend, and recent runs. Platform admins can trigger a run.
8. **Access.** `/api/ai` and the AI Models report require platform staff. Triggering an evaluation requires platform admin.

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

`OPENROUTER_API_KEY` (required), `OPENROUTER_APP_URL`, `AI_EVAL_GRADER_MODEL` (default `anthropic/claude-sonnet-5.5`), `AI_EVAL_RUN_BUDGET_USD`, `AI_EVAL_MODELS_PER_TASK`, `AI_EVAL_PROVIDER_PREFIXES`, `CRON_SECRET`.

## Rollback

Unset `OPENROUTER_API_KEY`: AI routes return 503 and the cron reports `disabled`. To pin a model, insert a row into `academy_ai_model_selections`. The newest row per kind wins until the evaluator finds a better model by the switch margin.
