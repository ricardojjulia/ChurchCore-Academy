import assert from "node:assert/strict";
import test from "node:test";
import {
  getAiModelsReport,
  runAiModelEvaluationNow,
  type AiModelsRouteDependencies,
} from "@/app/api/academy/platform/ai-models/route";
import { evaluation, InMemoryAiGatewayRepository, rawModel } from "@/modules/ai-gateway/__tests__/fixtures";
import { AiGatewayUnavailableError } from "@/modules/ai-gateway/types";

function dependencies(roles: string[], repository = new InMemoryAiGatewayRepository()): AiModelsRouteDependencies {
  return {
    roleResolver: async () => roles,
    repository: () => repository,
    evaluation: () => ({
      repository,
      client: {
        async listModels() {
          return [rawModel("anthropic/claude-sonnet-5.5")];
        },
        async complete() {
          throw new Error("unused");
        },
      },
    }),
    env: { NODE_ENV: "test", OPENROUTER_API_KEY: "test-key" } as NodeJS.ProcessEnv,
  };
}

test("platform staff get routing, leaderboards, and spend per ask", async () => {
  const repository = new InMemoryAiGatewayRepository();
  const recent = new Date(Date.now() - 86_400_000).toISOString();
  repository.evaluations.push(
    evaluation({ modelId: "openai/a", qualityScore: 0.8, costUsd: 0.002, evaluatedAt: recent }),
    evaluation({ modelId: "anthropic/b", qualityScore: 0.9, costUsd: 0.01, evaluatedAt: recent }),
  );
  repository.selections.push({ taskKind: "hq_reasoning", modelId: "openai/a", fallbackModelIds: ["anthropic/b"], fitScore: 0.8, reason: "Best fit", runId: "run-1", selectedAt: recent });
  repository.usage.push({ id: "usage-1", taskKind: "hq_reasoning", modelId: "openai/a", promptTokens: 1, completionTokens: 1, costUsd: 0.5, latencyMs: 10, status: "completed", createdAt: recent });

  const response = await getAiModelsReport(dependencies(["platform_staff"], repository));
  assert.equal(response.status, 200);
  const { report, configured, canRunEvaluation } = await response.json();
  assert.equal(configured, true);
  assert.equal(canRunEvaluation, false, "staff can read the report but the UI must not offer the admin-only run");

  const reasoning = report.tasks.find((task: { taskKind: string }) => task.taskKind === "hq_reasoning");
  assert.equal(reasoning.selection.modelId, "openai/a");
  assert.deepEqual(reasoning.leaderboard.map((row: { modelId: string }) => row.modelId), ["anthropic/b", "openai/a"]);
  assert.deepEqual(reasoning.usage, { requestCount: 1, costUsd: 0.5 });

  const writing = report.tasks.find((task: { taskKind: string }) => task.taskKind === "hq_writing");
  assert.equal(writing.selection.modelId, "openrouter/auto");
  assert.doesNotMatch(JSON.stringify(report), /test-key/);
});

test("the report rejects callers without platform access", async () => {
  assert.equal((await getAiModelsReport(dependencies([]))).status, 403);
  assert.equal((await getAiModelsReport(dependencies(["institution_admin"]))).status, 403);
});

test("only platform admins can trigger an evaluation run", async () => {
  assert.equal((await runAiModelEvaluationNow(dependencies(["platform_staff"]))).status, 403);

  const repository = new InMemoryAiGatewayRepository();
  const response = await runAiModelEvaluationNow(dependencies(["platform_admin"], repository));
  assert.equal(response.status, 200);
  const { summary } = await response.json();
  assert.equal(summary.status, "completed");
  assert.equal(repository.runs.length, 1);
});

test("an evaluation run without OpenRouter configured is a clear 503", async () => {
  const response = await runAiModelEvaluationNow({
    ...dependencies(["platform_admin"]),
    evaluation: () => {
      throw new AiGatewayUnavailableError();
    },
  });
  assert.equal(response.status, 503);
});

test("the report tells platform admins they may run an evaluation", async () => {
  const response = await getAiModelsReport(dependencies(["platform_staff", "platform_admin"]));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).canRunEvaluation, true);
});

test("an admin-triggered run while another run holds the lease is a 409, not a second run", async () => {
  const repository = new InMemoryAiGatewayRepository();
  repository.lease = { holderId: "cron-run", expiresAt: new Date(Date.now() + 600_000).toISOString() };

  const response = await runAiModelEvaluationNow(dependencies(["platform_admin"], repository));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /in progress/);
  assert.equal(repository.runs.length, 0);
});
