import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GRADER_MODEL, resolveEvaluationOptionsFromEnv } from "@/lib/ai-gateway";
import { DEFAULT_EVALUATION_OPTIONS } from "@/modules/ai-gateway/evaluation-runner";

function env(values: Record<string, string>) {
  return { NODE_ENV: "test", ...values } as NodeJS.ProcessEnv;
}

test("evaluation options read whole-number model counts and budgets from the environment", () => {
  const options = resolveEvaluationOptionsFromEnv(env({
    AI_EVAL_MODELS_PER_TASK: "4",
    AI_EVAL_RUN_BUDGET_USD: "1.25",
    AI_EVAL_PROVIDER_PREFIXES: "anthropic, openai/",
  }));
  assert.equal(options.modelsPerTask, 4);
  assert.equal(options.budgetUsd, 1.25);
  assert.deepEqual(options.providerPrefixes, ["anthropic/", "openai/"]);
  assert.equal(options.graderModel, DEFAULT_GRADER_MODEL);
});

test("a fractional, zero, or junk model count falls back to the default instead of flooring to zero", () => {
  for (const value of ["0.5", "2.7", "0", "-3", "many", ""]) {
    const options = resolveEvaluationOptionsFromEnv(env({ AI_EVAL_MODELS_PER_TASK: value }));
    assert.equal(options.modelsPerTask, DEFAULT_EVALUATION_OPTIONS.modelsPerTask, `AI_EVAL_MODELS_PER_TASK=${value}`);
    assert.ok(options.modelsPerTask >= 1);
  }
});
