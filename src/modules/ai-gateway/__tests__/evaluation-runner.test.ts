import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOpenRouterCatalog } from "@/modules/ai-gateway/catalog";
import { DEFAULT_EVALUATION_OPTIONS, interleaveProviders, planEvaluationTargets, runModelEvaluation } from "@/modules/ai-gateway/evaluation-runner";
import type { OpenRouterCompletionRequest } from "@/modules/ai-gateway/openrouter-client";
import { AI_TASK_PROFILES } from "@/modules/ai-gateway/task-profiles";
import { evaluation, InMemoryAiGatewayRepository, NOW, rawModel } from "@/modules/ai-gateway/__tests__/fixtures";

const GRADER = "anthropic/grader";

const catalogRaw = [
  rawModel(GRADER, { prompt: "0.000002", completion: "0.00001" }),
  rawModel("anthropic/strong", { prompt: "0.000002", completion: "0.00001", createdDaysAgo: 10 }),
  rawModel("openai/cheap", { prompt: "0.0000002", completion: "0.000001", createdDaysAgo: 20 }),
  rawModel("openai/broken", { prompt: "0.0000002", completion: "0.000001", createdDaysAgo: 5 }),
];

/** Fake OpenRouter: model answers include the case's required terms; the grader scores by model. */
function fakeClient(options: { judgeScores: Record<string, number>; failGrader?: boolean }) {
  const calls: OpenRouterCompletionRequest[] = [];
  return {
    calls,
    client: {
      async listModels() {
        return catalogRaw;
      },
      async complete(request: OpenRouterCompletionRequest) {
        calls.push(request);
        if (request.model === GRADER) {
          if (options.failGrader) throw new Error("grader down");
          const answer = request.messages[1].content;
          const model = Object.keys(options.judgeScores).find((id) => answer.includes(`[${id}]`)) ?? "";
          return {
            text: JSON.stringify({ score: options.judgeScores[model] ?? 0, rationale: "graded" }),
            model: GRADER,
            usage: { promptTokens: 1_000, completionTokens: 50, costUsd: 0.001 },
            latencyMs: 500,
          };
        }
        if (request.model === "openai/broken") throw new Error("provider error");
        const profileCase = Object.values(AI_TASK_PROFILES)
          .flatMap((profile) => profile.evaluationCases)
          .find((evaluationCase) => evaluationCase.prompt === request.messages[1].content);
        return {
          text: `[${request.model}] ${profileCase?.requiredTerms.join(" ") ?? ""}`,
          model: request.model,
          usage: { promptTokens: 400, completionTokens: 600, costUsd: 0.002 },
          latencyMs: request.model === "openai/cheap" ? 3_000 : 9_000,
        };
      },
    },
  };
}

const options = {
  ...DEFAULT_EVALUATION_OPTIONS,
  graderModel: GRADER,
  providerPrefixes: ["anthropic/", "openai/"],
  budgetUsd: 5,
  modelsPerTask: 3,
  taskKinds: ["hq_reasoning" as const],
};

test("a run evaluates challengers, grades them blind, and routes the ask to the best fit", async () => {
  const repository = new InMemoryAiGatewayRepository();
  const { client, calls } = fakeClient({ judgeScores: { "anthropic/strong": 9, "openai/cheap": 8 } });
  let id = 0;

  const summary = await runModelEvaluation(
    { client, repository, now: () => NOW, randomId: () => `run-${++id}` },
    options,
  );

  assert.equal(summary.status, "completed");
  assert.equal(summary.evaluatedModelCount, 3);
  // The grader never competes in the ask it judges.
  assert.ok(!repository.evaluations.some((record) => record.modelId === GRADER));
  assert.ok(calls.filter((call) => call.model === GRADER).every((call) => call.temperature === 0 && call.jsonResponse));

  const broken = repository.evaluations.filter((record) => record.modelId === "openai/broken");
  assert.equal(broken.length, 2);
  assert.ok(broken.every((record) => record.status === "failed" && record.qualityScore === 0));

  const [selection] = await repository.listCurrentSelections();
  assert.equal(selection.taskKind, "hq_reasoning");
  assert.equal(selection.modelId, "openai/cheap", "slightly lower quality but far cheaper and faster wins");
  assert.deepEqual(selection.fallbackModelIds, ["anthropic/strong"]);
  assert.deepEqual(summary.selectionChanges, [{ taskKind: "hq_reasoning", from: null, to: "openai/cheap" }]);
  assert.equal(repository.runs.length, 1);
  assert.ok(summary.spentUsd > 0);
});

test("a run stops starting work when the budget would be exceeded", async () => {
  const repository = new InMemoryAiGatewayRepository();
  const { client, calls } = fakeClient({ judgeScores: {} });

  const summary = await runModelEvaluation({ client, repository, now: () => NOW }, { ...options, budgetUsd: 0.0001 });

  assert.equal(summary.status, "budget_exhausted");
  assert.equal(calls.length, 0);
  assert.equal(repository.selections.length, 0, "nothing qualified, so no selection is recorded");
});

test("a run fails closed when the configured grader is not in the catalog", async () => {
  const repository = new InMemoryAiGatewayRepository();
  const { client, calls } = fakeClient({ judgeScores: {} });

  const summary = await runModelEvaluation({ client, repository, now: () => NOW }, { ...options, graderModel: "anthropic/missing" });

  assert.equal(summary.status, "failed");
  assert.equal(calls.length, 0);
  assert.equal(repository.runs[0].status, "failed");
});

test("grader failures drop samples instead of penalizing the candidate", async () => {
  const repository = new InMemoryAiGatewayRepository();
  const { client } = fakeClient({ judgeScores: {}, failGrader: true });

  await runModelEvaluation({ client, repository, now: () => NOW }, options);

  assert.ok(repository.evaluations.every((record) => record.modelId === "openai/broken"));
});

test("planning re-checks a stale incumbent first, then unseen models newest first", () => {
  const eligible = normalizeOpenRouterCatalog(catalogRaw.slice(1));
  const current = { taskKind: "hq_reasoning" as const, modelId: "openai/cheap", fallbackModelIds: [], fitScore: 0.8, reason: "", runId: "r", selectedAt: "2026-08-01T00:00:00.000Z" };
  const history = [evaluation({ modelId: "openai/cheap", evaluatedAt: "2026-08-01T00:00:00.000Z" })];

  const targets = planEvaluationTargets(eligible, history, current, { now: NOW, staleAfterDays: 21, modelsPerTask: 2 });
  assert.deepEqual(targets.map((candidate) => candidate.id), ["openai/cheap", "openai/broken"]);

  const fresh = [evaluation({ modelId: "openai/cheap", evaluatedAt: "2026-10-02T00:00:00.000Z" })];
  const skipFresh = planEvaluationTargets(eligible, fresh, current, { now: NOW, staleAfterDays: 21, modelsPerTask: 5 });
  assert.deepEqual(skipFresh.map((candidate) => candidate.id), ["openai/broken", "anthropic/strong"]);
});

test("evaluation records keep no prompt text, only a truncated answer to a synthetic case", async () => {
  const repository = new InMemoryAiGatewayRepository();
  const { client } = fakeClient({ judgeScores: { "anthropic/strong": 9, "openai/cheap": 8 } });

  await runModelEvaluation({ client, repository, now: () => NOW }, options);

  for (const record of repository.evaluations) {
    assert.ok(record.outputExcerpt.length <= 2_000);
    assert.doesNotMatch(JSON.stringify(record), /authorization|api[_-]?key|bearer/i);
  }
});

test("new models are tried round-robin across providers so one provider can't fill a run", () => {
  const ordered = normalizeOpenRouterCatalog([
    rawModel("openai/newest", { createdDaysAgo: 1 }),
    rawModel("openai/newer", { createdDaysAgo: 2 }),
    rawModel("openai/new", { createdDaysAgo: 3 }),
    rawModel("anthropic/recent", { createdDaysAgo: 4 }),
    rawModel("google/older", { createdDaysAgo: 9 }),
  ]);
  assert.deepEqual(interleaveProviders(ordered).map((candidate) => candidate.id), [
    "openai/newest", "anthropic/recent", "google/older", "openai/newer", "openai/new",
  ]);
});

test("a job only starts if its worst-case answer and grading time fit before the deadline", async () => {
  const repository = new InMemoryAiGatewayRepository();
  const { client, calls } = fakeClient({ judgeScores: {} });
  const reasoningWorstCase = AI_TASK_PROFILES.hq_reasoning.evaluationTimeoutMs + DEFAULT_EVALUATION_OPTIONS.graderTimeoutMs;

  const summary = await runModelEvaluation(
    { client, repository, now: () => NOW },
    { ...options, deadlineMs: reasoningWorstCase - 1 },
  );

  assert.equal(summary.status, "deadline_reached");
  assert.equal(calls.length, 0);
});
