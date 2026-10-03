import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOpenRouterCatalog } from "@/modules/ai-gateway/catalog";
import {
  DEFAULT_EVALUATION_OPTIONS,
  interleaveProviders,
  planEvaluationTargets,
  runModelEvaluation,
  worstCaseJobCostUsd,
} from "@/modules/ai-gateway/evaluation-runner";
import type { OpenRouterCompletionRequest } from "@/modules/ai-gateway/openrouter-client";
import { COLD_START_MODEL } from "@/modules/ai-gateway/scoring";
import { AI_TASK_PROFILES } from "@/modules/ai-gateway/task-profiles";
import { AiCompletionResult, AiEvaluationInProgressError } from "@/modules/ai-gateway/types";
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

  const plan = { now: NOW, staleAfterDays: 21, requiredCaseIds: ["case-a", "case-b"] };
  const targets = planEvaluationTargets(eligible, history, current, { ...plan, modelsPerTask: 2 });
  assert.deepEqual(targets.map((candidate) => candidate.id), ["openai/cheap", "openai/broken"]);

  const fresh = ["case-a", "case-b"].map((caseId) =>
    evaluation({ modelId: "openai/cheap", caseId, evaluatedAt: "2026-10-02T00:00:00.000Z" }));
  const skipFresh = planEvaluationTargets(eligible, fresh, current, { ...plan, modelsPerTask: 5 });
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

test("a fresh model missing a required case is retried immediately instead of waiting to go stale", () => {
  const eligible = normalizeOpenRouterCatalog(catalogRaw.slice(1));
  // A dropped grader sample left anthropic/strong with only case-a: it can't meet minSamples yet.
  const history = [
    evaluation({ modelId: "anthropic/strong", caseId: "case-a", evaluatedAt: "2026-10-02T00:00:00.000Z" }),
    ...["case-a", "case-b"].map((caseId) =>
      evaluation({ modelId: "openai/cheap", caseId, evaluatedAt: "2026-10-02T00:00:00.000Z" })),
  ];

  const targets = planEvaluationTargets(eligible, history, undefined, {
    now: NOW,
    staleAfterDays: 21,
    modelsPerTask: 1,
    requiredCaseIds: ["case-a", "case-b"],
  });
  assert.deepEqual(targets.map((candidate) => candidate.id), ["anthropic/strong"], "incomplete coverage outranks unseen models");

  const complete = planEvaluationTargets(eligible, history.slice(1), undefined, {
    now: NOW,
    staleAfterDays: 21,
    modelsPerTask: 5,
    requiredCaseIds: ["case-a", "case-b"],
  });
  assert.deepEqual(complete.map((candidate) => candidate.id), ["openai/broken", "anthropic/strong"]);
});

test("a run reserves each job's worst-case spend, so the budget is a hard cap", async () => {
  const catalog = normalizeOpenRouterCatalog(catalogRaw);
  const grader = catalog.find((candidate) => candidate.id === GRADER)!;
  const strong = catalog.find((candidate) => candidate.id === "anthropic/strong")!;
  const profile = AI_TASK_PROFILES.hq_reasoning;

  // Each case: up to 4,000 answer tokens, then a grader call carrying that full answer and up to
  // 400 grader tokens. The reservation must cover at least that much.
  const answerTokens = Math.min(profile.maxOutputTokens, 4_000);
  const floor = profile.evaluationCases.reduce((total, evaluationCase) => {
    // A byte-level tokenizer can emit one token per UTF-8 byte; the bound must cover that.
    const promptBytes = new TextEncoder().encode(evaluationCase.system + evaluationCase.prompt).length;
    return total + (
      strong.promptUsdPerMillion * promptBytes +
      strong.completionUsdPerMillion * answerTokens +
      grader.promptUsdPerMillion * answerTokens +
      grader.completionUsdPerMillion * 400
    ) / 1_000_000;
  }, 0);
  const worstCase = worstCaseJobCostUsd(strong, grader, profile);
  assert.ok(worstCase > floor, `${worstCase} must exceed the output-only floor ${floor}`);

  // A budget that covers the output tokens alone but not the full worst case: nothing may start.
  const repository = new InMemoryAiGatewayRepository();
  const { client, calls } = fakeClient({ judgeScores: {} });
  const summary = await runModelEvaluation(
    { client, repository, now: () => NOW },
    // anthropic/strong is then the only candidate (the grader never competes).
    { ...options, providerPrefixes: ["anthropic/"], budgetUsd: floor },
  );
  assert.equal(summary.status, "budget_exhausted");
  assert.equal(calls.length, 0);
});

test("a run refuses to start while another run holds the evaluation lease, and releases its own", async () => {
  const repository = new InMemoryAiGatewayRepository();
  const { client, calls } = fakeClient({ judgeScores: { "anthropic/strong": 9, "openai/cheap": 8 } });

  repository.lease = { holderId: "cron-run", expiresAt: new Date(NOW.getTime() + 60_000).toISOString() };
  await assert.rejects(
    runModelEvaluation({ client, repository, now: () => NOW }, options),
    AiEvaluationInProgressError,
  );
  assert.equal(calls.length, 0, "a blocked run spends nothing");
  assert.equal(repository.runs.length, 0);
  assert.equal(repository.lease?.holderId, "cron-run", "the blocked run leaves the holder's lease alone");

  // An expired lease (a crashed run) does not block forever.
  repository.lease = { holderId: "crashed-run", expiresAt: new Date(NOW.getTime() - 1).toISOString() };
  const summary = await runModelEvaluation({ client, repository, now: () => NOW, randomId: () => "run-after" }, options);
  assert.equal(summary.status, "completed");
  assert.equal(repository.lease, undefined, "the lease is released when the run finishes");
});

test("the lease is released even when the run throws", async () => {
  const repository = new InMemoryAiGatewayRepository();
  const client = {
    async listModels(): Promise<unknown[]> {
      throw new Error("catalog down");
    },
    async complete(): Promise<never> {
      throw new Error("unused");
    },
  };
  await assert.rejects(runModelEvaluation({ client, repository, now: () => NOW }, options), /catalog down/);
  assert.equal(repository.lease, undefined);
});

test("an incumbent that left the catalog is replaced by the auto-router when nothing qualifies", async () => {
  const repository = new InMemoryAiGatewayRepository();
  repository.selections.push({
    taskKind: "hq_reasoning",
    modelId: "anthropic/retired",
    fallbackModelIds: ["openai/cheap"],
    fitScore: 0.8,
    reason: "Best fit",
    runId: "old",
    selectedAt: "2026-09-01T00:00:00.000Z",
  });
  // Every candidate scores 0, so none clears the quality floor.
  const { client } = fakeClient({ judgeScores: {} });

  const summary = await runModelEvaluation({ client, repository, now: () => NOW }, options);

  const [selection] = await repository.listCurrentSelections();
  assert.equal(selection.modelId, COLD_START_MODEL);
  assert.deepEqual(selection.fallbackModelIds, []);
  assert.deepEqual(summary.selectionChanges, [{ taskKind: "hq_reasoning", from: "anthropic/retired", to: COLD_START_MODEL }]);
});

test("failed and usage-less calls are charged at their worst case, so timeouts cannot free budget", async () => {
  const catalog = normalizeOpenRouterCatalog(catalogRaw);
  const grader = catalog.find((candidate) => candidate.id === GRADER)!;
  const broken = catalog.find((candidate) => candidate.id === "openai/broken")!;
  const profile = AI_TASK_PROFILES.hq_reasoning;
  const repository = new InMemoryAiGatewayRepository();
  const { client } = fakeClient({ judgeScores: {} });

  // openai/broken fails every answer; it is the only candidate.
  const summary = await runModelEvaluation(
    { client, repository, now: () => NOW },
    { ...options, providerPrefixes: ["openai/broken"] },
  );

  // Charged the answers' worst case, but not the grading that never happened.
  assert.ok(summary.spentUsd > 0, "a failed request is not free");
  assert.ok(summary.spentUsd < worstCaseJobCostUsd(broken, grader, profile));
  assert.ok(repository.evaluations.every((record) => record.status === "failed" && record.costUsd === 0));

  // A grader that answers without usage is charged its worst case too.
  const quiet = new InMemoryAiGatewayRepository();
  const noUsage = fakeClient({ judgeScores: { "anthropic/strong": 9 } });
  const quietClient = {
    listModels: noUsage.client.listModels,
    async complete(request: OpenRouterCompletionRequest): Promise<AiCompletionResult> {
      const result = await noUsage.client.complete(request);
      return request.model === GRADER ? { ...result, usage: { promptTokens: 0, completionTokens: 0 } } : result;
    },
  };
  const quietSummary = await runModelEvaluation(
    { client: quietClient, repository: quiet, now: () => NOW },
    { ...options, providerPrefixes: ["anthropic/strong"] },
  );
  const strong = catalog.find((candidate) => candidate.id === "anthropic/strong")!;
  const answers = 0.002 * profile.evaluationCases.length;
  assert.ok(quietSummary.spentUsd > answers, "the usage-less grader calls were charged, not counted as zero");
  assert.ok(quietSummary.spentUsd <= worstCaseJobCostUsd(strong, grader, profile) + 1e-6);
});

test("a re-evaluated incumbent that falls below the quality floor is replaced by the auto-router", async () => {
  const repository = new InMemoryAiGatewayRepository();
  repository.selections.push({
    taskKind: "hq_reasoning",
    modelId: "anthropic/strong",
    fallbackModelIds: [],
    fitScore: 0.8,
    reason: "Best fit",
    runId: "old",
    selectedAt: "2026-08-01T00:00:00.000Z",
  });
  // No history in the window, so the incumbent is stale and re-checked; the grader now scores it 0.
  const { client } = fakeClient({ judgeScores: {} });

  const summary = await runModelEvaluation(
    { client, repository, now: () => NOW },
    { ...options, providerPrefixes: ["anthropic/strong"] },
  );

  assert.ok(repository.evaluations.some((record) => record.modelId === "anthropic/strong"), "the incumbent was re-evaluated");
  const [selection] = await repository.listCurrentSelections();
  assert.equal(selection.modelId, COLD_START_MODEL);
  assert.match(selection.reason, /below the quality floor/);
  assert.deepEqual(summary.selectionChanges, [{ taskKind: "hq_reasoning", from: "anthropic/strong", to: COLD_START_MODEL }]);
});

test("a job blocked only by in-flight reservations waits for them instead of ending the run", async () => {
  const catalog = normalizeOpenRouterCatalog(catalogRaw);
  const grader = catalog.find((candidate) => candidate.id === GRADER)!;
  const byId = (id: string) => catalog.find((candidate) => candidate.id === id)!;
  const profile = AI_TASK_PROFILES.hq_reasoning;
  const cost = (id: string) => worstCaseJobCostUsd(byId(id), grader, profile);
  const repository = new InMemoryAiGatewayRepository();
  const { client } = fakeClient({ judgeScores: { "anthropic/strong": 9, "openai/cheap": 8 } });

  // Room for the two jobs that start together, but not for a third while they are in flight.
  const budgetUsd = cost("openai/broken") + cost("anthropic/strong") + cost("openai/cheap") * 0.5;
  const summary = await runModelEvaluation(
    { client, repository, now: () => NOW },
    { ...options, budgetUsd, concurrency: 2 },
  );

  const evaluated = new Set(repository.evaluations.map((record) => record.modelId));
  assert.ok(evaluated.has("openai/cheap"), "the third job ran once a reservation was released");
  assert.equal(summary.status, "completed");
});

test("a job too expensive even on its own is dropped without stopping cheaper ones behind it", async () => {
  const catalog = normalizeOpenRouterCatalog(catalogRaw);
  const grader = catalog.find((candidate) => candidate.id === GRADER)!;
  const cheap = catalog.find((candidate) => candidate.id === "openai/cheap")!;
  const strong = catalog.find((candidate) => candidate.id === "anthropic/strong")!;
  const profile = AI_TASK_PROFILES.hq_reasoning;
  const repository = new InMemoryAiGatewayRepository();
  const { client, calls } = fakeClient({ judgeScores: { "openai/cheap": 8 } });

  // Planned order is openai/broken, anthropic/strong, openai/cheap; strong can never fit.
  const budgetUsd = worstCaseJobCostUsd(cheap, grader, profile) * 2.5;
  assert.ok(worstCaseJobCostUsd(strong, grader, profile) > budgetUsd);
  const summary = await runModelEvaluation(
    { client, repository, now: () => NOW },
    { ...options, budgetUsd, concurrency: 1 },
  );

  assert.equal(summary.status, "budget_exhausted");
  assert.ok(!calls.some((call) => call.model === "anthropic/strong"));
  assert.ok(repository.evaluations.some((record) => record.modelId === "openai/cheap"));
});

test("a run's evaluations, selections, and summary are written together or not at all", async () => {
  const repository = new InMemoryAiGatewayRepository();
  repository.failFinalize = true;
  const { client } = fakeClient({ judgeScores: { "anthropic/strong": 9, "openai/cheap": 8 } });

  await assert.rejects(runModelEvaluation({ client, repository, now: () => NOW }, options), /finalize failed/);

  assert.equal(repository.runs.length, 0);
  assert.equal(repository.evaluations.length, 0, "no evaluation rows without their run");
  assert.equal(repository.selections.length, 0, "no live selection without the run that explains it");
  assert.equal(repository.lease, undefined, "the lease is still released");
});
