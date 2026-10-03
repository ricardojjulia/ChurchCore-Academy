import assert from "node:assert/strict";
import test from "node:test";
import { eligibleCandidates, estimateRequestCostUsd, normalizeOpenRouterCatalog } from "@/modules/ai-gateway/catalog";
import {
  aggregateEvaluations,
  belowFloorModelIds,
  chooseSelection,
  COLD_START_MODEL,
  parseJudgeVerdict,
  rankModels,
  scoreDeterministic,
  SELECTION_SWITCH_MARGIN,
} from "@/modules/ai-gateway/scoring";
import { AI_TASK_PROFILES, resolveHqTaskKind } from "@/modules/ai-gateway/task-profiles";
import { evaluation, NOW, rawModel } from "@/modules/ai-gateway/__tests__/fixtures";

const reasoning = AI_TASK_PROFILES.hq_reasoning;
const filterOptions = { now: NOW, providerPrefixes: ["anthropic/", "openai/"], maxAgeDays: 365 };
const reasoningCaseIds = reasoning.evaluationCases.map((evaluationCase) => evaluationCase.id);

test("normalizes priced text models and drops routers, variants, and non-text output", () => {
  const catalog = normalizeOpenRouterCatalog([
    rawModel("anthropic/model-a", { prompt: "0.000002", completion: "0.00001" }),
    rawModel("openrouter/auto", { prompt: "-1", completion: "-1" }),
    rawModel("openai/model-b:free", { prompt: "0", completion: "0" }),
    rawModel("openai/model-b:batch"),
    rawModel("openai/image-model", { outputs: ["image", "text"] }),
    { id: 42 },
    null,
  ]);

  assert.deepEqual(catalog.map((candidate) => candidate.id), ["anthropic/model-a"]);
  assert.equal(catalog[0].promptUsdPerMillion, 2);
  assert.equal(catalog[0].completionUsdPerMillion, 10);
  assert.equal(catalog[0].maxCompletionTokens, 32_000);
});

test("eligibility enforces provider allow-list, context, age, expiry, and the cost ceiling", () => {
  const catalog = normalizeOpenRouterCatalog([
    rawModel("anthropic/ok"),
    rawModel("unknownlab/model"),
    rawModel("openai/tiny-context", { context: 8_000 }),
    rawModel("openai/ancient", { createdDaysAgo: 900 }),
    rawModel("openai/expiring", { expiration: "2026-10-10" }),
    rawModel("openai/premium", { prompt: "0.00003", completion: "0.00018" }),
  ]);

  const eligible = eligibleCandidates(catalog, reasoning, filterOptions);
  assert.deepEqual(eligible.map((candidate) => candidate.id), ["anthropic/ok"]);
});

test("estimates request cost from the profile's typical token mix", () => {
  const [candidate] = normalizeOpenRouterCatalog([rawModel("anthropic/a", { prompt: "0.000002", completion: "0.00001" })]);
  // 3000 prompt tokens * $2/M + 1500 completion tokens * $10/M
  assert.equal(estimateRequestCostUsd(candidate, reasoning).toFixed(4), "0.0210");
});

test("deterministic score rewards required terms and penalizes bloat", () => {
  const evaluationCase = { ...reasoning.evaluationCases[0], requiredTerms: ["tenant", "audit"], maxWords: 10 };
  assert.equal(scoreDeterministic("", evaluationCase), 0);
  assert.equal(scoreDeterministic("Check tenant and audit.", evaluationCase), 1);
  assert.equal(scoreDeterministic("Check tenant only.", evaluationCase), 0.5);
  const bloated = `tenant audit ${"word ".repeat(13)}`;
  assert.ok(scoreDeterministic(bloated, evaluationCase) < 1);
});

test("judge verdict parsing rejects out-of-range or malformed output", () => {
  assert.deepEqual(parseJudgeVerdict('{"score": 8, "rationale": "good"}'), { score: 0.8, rationale: "good" });
  assert.deepEqual(parseJudgeVerdict('Here you go: {"score": "7", "rationale": "ok"}'), { score: 0.7, rationale: "ok" });
  assert.equal(parseJudgeVerdict('{"score": 14}'), undefined);
  assert.equal(parseJudgeVerdict("no json"), undefined);
  assert.equal(parseJudgeVerdict("{not json}"), undefined);
});

test("aggregation counts failed attempts as zero quality", () => {
  const [aggregate] = aggregateEvaluations([
    evaluation({ qualityScore: 0.9, latencyMs: 4_000 }),
    evaluation({ status: "failed", qualityScore: 0, caseId: "case-b" }),
  ]);
  assert.equal(aggregate.sampleCount, 2);
  assert.equal(aggregate.meanQuality, 0.45);
  assert.equal(aggregate.medianLatencyMs, 4_000);
});

test("ranking trades quality against live price and drops models below the quality floor", () => {
  const catalog = normalizeOpenRouterCatalog([
    rawModel("anthropic/premium", { prompt: "0.000005", completion: "0.000025" }),
    rawModel("openai/budget", { prompt: "0.0000002", completion: "0.000001" }),
    rawModel("openai/weak", { prompt: "0.0000001", completion: "0.0000005" }),
  ]);
  const eligible = eligibleCandidates(catalog, reasoning, filterOptions);
  const records = [
    ...reasoningCaseIds.map((caseId) => evaluation({ modelId: "anthropic/premium", caseId, qualityScore: 0.95 })),
    ...reasoningCaseIds.map((caseId) => evaluation({ modelId: "openai/budget", caseId, qualityScore: 0.86 })),
    ...reasoningCaseIds.map((caseId) => evaluation({ modelId: "openai/weak", caseId, qualityScore: 0.5 })),
  ];

  const ranked = rankModels(reasoning, aggregateEvaluations(records), eligible);
  assert.deepEqual(ranked.map((model) => model.modelId), ["openai/budget", "anthropic/premium"]);
  assert.ok(ranked[0].estimatedRequestCostUsd < ranked[1].estimatedRequestCostUsd);
});

test("ranking needs enough samples and a model still present in the catalog", () => {
  const eligible = eligibleCandidates(normalizeOpenRouterCatalog([rawModel("anthropic/a")]), reasoning, filterOptions);
  const ranked = rankModels(
    reasoning,
    aggregateEvaluations([
      evaluation({ modelId: "anthropic/a", caseId: reasoningCaseIds[0] }),
      ...reasoningCaseIds.map((caseId) => evaluation({ modelId: "anthropic/retired", caseId })),
    ]),
    eligible,
  );
  assert.deepEqual(ranked, []);
});

test("a model qualifies only with a sample for every case, not repeated samples of one", () => {
  const eligible = eligibleCandidates(normalizeOpenRouterCatalog([rawModel("anthropic/a"), rawModel("openai/b")]), reasoning, filterOptions);
  const [first, second] = reasoningCaseIds;
  const records = [
    // Two strong samples of the first case; the grader kept failing on the second.
    evaluation({ modelId: "anthropic/a", caseId: first, runId: "run-1" }),
    evaluation({ modelId: "anthropic/a", caseId: first, runId: "run-2" }),
    // Covers both cases; a failed answer still counts as evidence.
    evaluation({ modelId: "openai/b", caseId: first, qualityScore: 1 }),
    evaluation({ modelId: "openai/b", caseId: second, qualityScore: 0.8 }),
  ];
  const aggregates = aggregateEvaluations(records);
  assert.deepEqual(aggregates.find((aggregate) => aggregate.modelId === "anthropic/a")?.coveredCaseIds, [first]);

  const ranked = rankModels(reasoning, aggregates, eligible);
  assert.deepEqual(ranked.map((model) => model.modelId), ["openai/b"]);
});

test("selection keeps the incumbent unless a challenger clears the switch margin", () => {
  const base = { meanQuality: 0.9, qualityScore: 0.9, costScore: 0.5, latencyScore: 0.5, estimatedRequestCostUsd: 0.01, medianLatencyMs: 5_000, sampleCount: 2 };
  const current = { taskKind: "hq_reasoning" as const, modelId: "anthropic/incumbent", fallbackModelIds: [], fitScore: 0.8, reason: "", runId: "old", selectedAt: "2026-09-01T00:00:00.000Z" };
  const context = { runId: "run-2", now: NOW.toISOString(), eligibleModelIds: new Set(["anthropic/incumbent", "openai/challenger"]) };

  const close = chooseSelection(reasoning, [
    { ...base, modelId: "openai/challenger", fitScore: 0.81 },
    { ...base, modelId: "anthropic/incumbent", fitScore: 0.8 },
  ], current, context);
  assert.equal(close.modelId, "anthropic/incumbent");
  assert.deepEqual(close.fallbackModelIds, ["openai/challenger"]);

  const clear = chooseSelection(reasoning, [
    { ...base, modelId: "openai/challenger", fitScore: 0.8 + SELECTION_SWITCH_MARGIN + 0.01 },
    { ...base, modelId: "anthropic/incumbent", fitScore: 0.8 },
  ], current, context);
  assert.equal(clear.modelId, "openai/challenger");
  assert.deepEqual(clear.fallbackModelIds, ["anthropic/incumbent"]);
});

test("selection falls back to the cold-start auto-router when nothing has qualified", () => {
  const selection = chooseSelection(reasoning, [], undefined, { runId: "run-1", now: NOW.toISOString(), eligibleModelIds: new Set() });
  assert.equal(selection.modelId, COLD_START_MODEL);
  assert.equal(selection.fitScore, null);
});

test("with no challenger, an eligible incumbent stays but an ineligible one falls back to the auto-router", () => {
  const current = {
    taskKind: "hq_reasoning" as const,
    modelId: "anthropic/incumbent",
    fallbackModelIds: ["openai/still-listed", "openai/delisted"],
    fitScore: 0.8,
    reason: "",
    runId: "old",
    selectedAt: "2026-09-01T00:00:00.000Z",
  };

  const kept = chooseSelection(reasoning, [], current, {
    runId: "run-2",
    now: NOW.toISOString(),
    eligibleModelIds: new Set(["anthropic/incumbent", "openai/still-listed"]),
  });
  assert.equal(kept.modelId, "anthropic/incumbent");
  assert.deepEqual(kept.fallbackModelIds, ["openai/still-listed"], "ineligible fallbacks are dropped too");
  assert.equal(kept.fitScore, 0.8);

  // Delisted, expiring, or now over the price cap: the known-ineligible model must not keep serving.
  const retired = chooseSelection(reasoning, [], current, {
    runId: "run-2",
    now: NOW.toISOString(),
    eligibleModelIds: new Set(["openai/still-listed"]),
  });
  assert.equal(retired.modelId, COLD_START_MODEL);
  assert.deepEqual(retired.fallbackModelIds, []);
  assert.equal(retired.fitScore, null);
  assert.match(retired.reason, /no longer eligible/);
});

test("an incumbent judged below the floor on complete evidence stops serving; incomplete evidence does not", () => {
  const [first] = reasoningCaseIds;
  const aggregates = aggregateEvaluations([
    ...reasoningCaseIds.map((caseId) => evaluation({ modelId: "anthropic/incumbent", caseId, qualityScore: 0.3 })),
    // Below the floor so far, but only one case: not yet a verdict.
    evaluation({ modelId: "openai/partial", caseId: first, qualityScore: 0.3 }),
  ]);
  const belowFloor = belowFloorModelIds(reasoning, aggregates);
  assert.deepEqual([...belowFloor], ["anthropic/incumbent"]);

  const current = {
    taskKind: "hq_reasoning" as const,
    modelId: "anthropic/incumbent",
    fallbackModelIds: [],
    fitScore: 0.8,
    reason: "",
    runId: "old",
    selectedAt: "2026-09-01T00:00:00.000Z",
  };
  const eligibleModelIds = new Set(["anthropic/incumbent", "openai/partial"]);

  const dropped = chooseSelection(reasoning, [], current, { runId: "run-2", now: NOW.toISOString(), eligibleModelIds, belowFloorModelIds: belowFloor });
  assert.equal(dropped.modelId, COLD_START_MODEL);
  assert.match(dropped.reason, /below the quality floor/);

  const partialIncumbent = { ...current, modelId: "openai/partial" };
  const kept = chooseSelection(reasoning, [], partialIncumbent, { runId: "run-2", now: NOW.toISOString(), eligibleModelIds, belowFloorModelIds: belowFloor });
  assert.equal(kept.modelId, "openai/partial", "incomplete evidence is not a below-floor verdict");
});

test("eligibility requires the ask's full output ceiling, not a fixed minimum", () => {
  const withCompletionLimit = (id: string, maxCompletionTokens: number) => ({
    ...rawModel(id),
    top_provider: { context_length: 200_000, max_completion_tokens: maxCompletionTokens },
  });
  const catalog = normalizeOpenRouterCatalog([
    withCompletionLimit("openai/short-output", 4_096),
    withCompletionLimit("anthropic/long-output", 16_000),
    // No published completion limit: not excluded on a limit we cannot see.
    { ...rawModel("anthropic/unknown-limit"), top_provider: { context_length: 200_000 } },
  ]);
  const writing = AI_TASK_PROFILES.hq_writing;
  assert.ok(reasoning.maxOutputTokens > 4_096 && writing.maxOutputTokens <= 4_096);

  assert.deepEqual(
    eligibleCandidates(catalog, reasoning, filterOptions).map((candidate) => candidate.id),
    ["anthropic/long-output", "anthropic/unknown-limit"],
  );
  assert.deepEqual(
    eligibleCandidates(catalog, writing, filterOptions).map((candidate) => candidate.id),
    ["openai/short-output", "anthropic/long-output", "anthropic/unknown-limit"],
  );
});

test("HQ agents map to asks, and council review overrides the agent", () => {
  assert.equal(resolveHqTaskKind("architect"), "hq_reasoning");
  assert.equal(resolveHqTaskKind("implementer"), "hq_engineering");
  assert.equal(resolveHqTaskKind("writer"), "hq_writing");
  assert.equal(resolveHqTaskKind("product", "council_review"), "hq_council_review");
  assert.equal(resolveHqTaskKind("unknown-agent"), "hq_reasoning");
});

test("every task profile is internally consistent", () => {
  for (const profile of Object.values(AI_TASK_PROFILES)) {
    const { quality, cost, latency } = profile.weights;
    assert.equal(Number((quality + cost + latency).toFixed(6)), 1, profile.kind);
    assert.ok(profile.evaluationCases.length >= 2, profile.kind);
    assert.ok(profile.referenceCostUsd < profile.maxRequestCostUsd, profile.kind);
    assert.equal(new Set(profile.evaluationCases.map((evaluationCase) => evaluationCase.id)).size, profile.evaluationCases.length);
  }
});
