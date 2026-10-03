import assert from "node:assert/strict";
import test from "node:test";
import { PostgresAiGatewayRepository } from "@/modules/ai-gateway/postgres-repository";
import { evaluation } from "@/modules/ai-gateway/__tests__/fixtures";
import type { AiEvaluationRunSummary, AiModelSelection } from "@/modules/ai-gateway/types";

// SQL-shape test with a fake pg Pool: the transaction must run on one checked-out client. Real
// Postgres behavior (triggers, lease, persistence) is covered by e2e/journeys/ai-model-routing.

function fakePool(options: { failOn?: RegExp } = {}) {
  const log: string[] = [];
  let released = 0;
  const client = {
    async query(sql: string) {
      const statement = sql.trim().split(/\s+/).slice(0, 3).join(" ");
      log.push(statement);
      if (options.failOn?.test(sql)) throw new Error("insert failed");
      return { rowCount: 1, rows: [] };
    },
    release() {
      released += 1;
    },
  };
  return {
    log,
    released: () => released,
    pool: {
      async query(): Promise<never> {
        throw new Error("finalizeRun must not use pooled queries outside its client");
      },
      async connect() {
        return client;
      },
    },
  };
}

const summary: AiEvaluationRunSummary = {
  runId: "00000000-0000-4000-8000-000000000001",
  startedAt: "2026-10-03T12:00:00.000Z",
  finishedAt: "2026-10-03T12:01:00.000Z",
  status: "completed",
  spentUsd: 0.01,
  evaluatedModelCount: 1,
  selectionChanges: [],
};
const selection: AiModelSelection = {
  taskKind: "hq_reasoning",
  modelId: "openai/a",
  fallbackModelIds: [],
  fitScore: 0.8,
  reason: "Best fit",
  runId: summary.runId,
  selectedAt: summary.finishedAt,
};

test("finalizeRun writes the run, evaluations, and selections in one transaction on one client", async () => {
  const { pool, log, released } = fakePool();
  await new PostgresAiGatewayRepository(pool).finalizeRun(summary, [evaluation(), evaluation({ caseId: "case-b" })], [selection]);

  assert.deepEqual(log, [
    "begin",
    "insert into academy_ai_evaluation_runs",
    "insert into academy_ai_model_evaluations",
    "insert into academy_ai_model_evaluations",
    "insert into academy_ai_model_selections",
    "commit",
  ]);
  assert.equal(released(), 1);
});

test("finalizeRun rolls back and releases the client when any write fails", async () => {
  const { pool, log, released } = fakePool({ failOn: /academy_ai_model_selections/ });
  await assert.rejects(
    new PostgresAiGatewayRepository(pool).finalizeRun(summary, [evaluation()], [selection]),
    /insert failed/,
  );

  assert.equal(log.at(-1), "rollback");
  assert.ok(!log.includes("commit"));
  assert.equal(released(), 1);
});
