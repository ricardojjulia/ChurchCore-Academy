import { DEFAULT_PROVIDER_PREFIXES } from "@/modules/ai-gateway/catalog";
import { DEFAULT_EVALUATION_OPTIONS, EvaluationRunOptions } from "@/modules/ai-gateway/evaluation-runner";
import { AiGateway } from "@/modules/ai-gateway/gateway";
import { OpenRouterClient } from "@/modules/ai-gateway/openrouter-client";
import { PostgresAiGatewayRepository } from "@/modules/ai-gateway/postgres-repository";
import { AiGatewayUnavailableError } from "@/modules/ai-gateway/types";

// Route-layer wiring for the AI gateway: the only place OpenRouter configuration is read from
// the environment (CLAUDE.md: never resolve process.env inside module domain functions).

export const DEFAULT_GRADER_MODEL = "anthropic/claude-sonnet-5.5";

export function createOpenRouterClientFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AiGatewayUnavailableError();
  }
  return new OpenRouterClient({
    apiKey,
    appUrl: env.OPENROUTER_APP_URL || env.NEXT_PUBLIC_SITE_URL || undefined,
    appTitle: "ChurchCore Academy",
    // Only the e2e suite overrides this, to point at its local deterministic OpenRouter stub.
    baseUrl: env.OPENROUTER_BASE_URL || undefined,
  });
}

export function createAiGatewayFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return new AiGateway({
    client: createOpenRouterClientFromEnv(env),
    repository: new PostgresAiGatewayRepository(),
    onUsageError: (_error, record) => {
      // Emitted after retries so spend can be reconciled from logs. The record holds counts and
      // cost only, never prompt or completion content; the database error itself is not logged.
      console.error(JSON.stringify({ source: "churchcore-academy", event: "ai_gateway_usage_unrecorded", record }));
    },
  });
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Counts must be whole and at least 1; anything else (e.g. "0.5") falls back to the default. */
function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

export function resolveEvaluationOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): EvaluationRunOptions {
  const prefixes = (env.AI_EVAL_PROVIDER_PREFIXES ?? "")
    .split(",")
    .map((prefix) => prefix.trim())
    .filter(Boolean)
    .map((prefix) => (prefix.endsWith("/") ? prefix : `${prefix}/`));

  return {
    ...DEFAULT_EVALUATION_OPTIONS,
    graderModel: env.AI_EVAL_GRADER_MODEL || DEFAULT_GRADER_MODEL,
    budgetUsd: positiveNumber(env.AI_EVAL_RUN_BUDGET_USD, DEFAULT_EVALUATION_OPTIONS.budgetUsd),
    modelsPerTask: positiveInteger(env.AI_EVAL_MODELS_PER_TASK, DEFAULT_EVALUATION_OPTIONS.modelsPerTask),
    providerPrefixes: prefixes.length > 0 ? prefixes : DEFAULT_PROVIDER_PREFIXES,
  };
}
