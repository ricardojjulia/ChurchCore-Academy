import assert from "node:assert/strict";
import test from "node:test";
import { handleModelEvaluationCron } from "@/app/api/cron/ai-model-evaluation/route";
import { InMemoryAiGatewayRepository, rawModel } from "@/modules/ai-gateway/__tests__/fixtures";

function cronRequest(authorization?: string) {
  return new Request("http://localhost/api/cron/ai-model-evaluation", {
    headers: authorization ? { authorization } : {},
  });
}

const env = { NODE_ENV: "test", CRON_SECRET: "cron-secret", AI_EVAL_GRADER_MODEL: "anthropic/grader", AI_EVAL_RUN_BUDGET_USD: "1" } as NodeJS.ProcessEnv;

test("rejects requests without the cron secret", async () => {
  assert.equal((await handleModelEvaluationCron(cronRequest(), env)).status, 401);
  assert.equal((await handleModelEvaluationCron(cronRequest("Bearer wrong"), env)).status, 401);
  assert.equal((await handleModelEvaluationCron(cronRequest("Bearer cron-secret"), { ...env, CRON_SECRET: "" })).status, 401);
});

test("reports disabled when OpenRouter is not configured", async () => {
  const response = await handleModelEvaluationCron(cronRequest("Bearer cron-secret"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "disabled" });
});

test("runs one evaluation cycle and returns its summary", async () => {
  const repository = new InMemoryAiGatewayRepository();
  const response = await handleModelEvaluationCron(cronRequest("Bearer cron-secret"), env, () => ({
    repository,
    client: {
      async listModels() {
        return [rawModel("anthropic/grader")];
      },
      async complete() {
        throw new Error("no candidates should be called");
      },
    },
  }));

  assert.equal(response.status, 200);
  const summary = await response.json();
  assert.equal(summary.status, "completed");
  assert.equal(summary.evaluatedModelCount, 0);
  assert.equal(repository.runs.length, 1);
});

test("returns 500 when the configured grader is missing so the failure is visible", async () => {
  const response = await handleModelEvaluationCron(cronRequest("Bearer cron-secret"), env, () => ({
    repository: new InMemoryAiGatewayRepository(),
    client: {
      async listModels() {
        return [];
      },
      async complete() {
        throw new Error("unused");
      },
    },
  }));
  assert.equal(response.status, 500);
});

test("a cron tick while an admin-triggered run holds the lease skips instead of overlapping", async () => {
  const repository = new InMemoryAiGatewayRepository();
  repository.lease = { holderId: "admin-run", expiresAt: new Date(Date.now() + 600_000).toISOString() };
  let catalogLoads = 0;

  const response = await handleModelEvaluationCron(cronRequest("Bearer cron-secret"), env, () => ({
    repository,
    client: {
      async listModels() {
        catalogLoads += 1;
        return [rawModel("anthropic/grader")];
      },
      async complete() {
        throw new Error("unused");
      },
    },
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "skipped", reason: "evaluation_in_progress" });
  assert.equal(catalogLoads, 0);
  assert.equal(repository.runs.length, 0);
});
