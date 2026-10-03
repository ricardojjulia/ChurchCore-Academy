import { estimateRequestCostUsd } from "@/modules/ai-gateway/catalog";
import {
  AiEvaluationCase,
  AiModelAggregate,
  AiModelCandidate,
  AiModelEvaluationRecord,
  AiModelSelection,
  AiRankedModel,
  AiTaskProfile,
} from "@/modules/ai-gateway/types";

/** Used until the evaluator has qualified a model for a task: OpenRouter's own auto-router. */
export const COLD_START_MODEL = "openrouter/auto";

/** A challenger must beat the incumbent's fit score by this much to replace it. */
export const SELECTION_SWITCH_MARGIN = 0.02;

const JUDGE_WEIGHT = 0.75;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Cheap, model-free checks: required terms present and the answer is not bloated. */
export function scoreDeterministic(output: string, evaluationCase: AiEvaluationCase) {
  if (!output.trim()) return 0;
  const lower = output.toLowerCase();
  const terms = evaluationCase.requiredTerms;
  const coverage = terms.length === 0
    ? 1
    : terms.filter((term) => lower.includes(term.toLowerCase())).length / terms.length;
  const words = wordCount(output);
  const lengthFactor = words <= evaluationCase.maxWords
    ? 1
    : clamp01(1 - (words - evaluationCase.maxWords) / evaluationCase.maxWords);
  return clamp01(coverage * lengthFactor);
}

export function combineQuality(judgeScore: number, deterministicScore: number) {
  return clamp01(JUDGE_WEIGHT * judgeScore + (1 - JUDGE_WEIGHT) * deterministicScore);
}

/**
 * The graded answer is cut to this many UTF-8 bytes. A byte-level tokenizer emits at most one
 * token per byte, so this bounds the grader's prompt cost no matter how the candidate tokenized
 * its answer (a 4,000-token answer can be far more than 4,000 grader tokens).
 */
export const MAX_GRADED_ANSWER_BYTES = 16_000;

/** Truncates to at most `maxBytes` of UTF-8 without splitting a character. */
export function truncateUtf8(text: string, maxBytes: number) {
  const encoded = new TextEncoder().encode(text);
  if (encoded.length <= maxBytes) return text;
  return new TextDecoder("utf-8", { fatal: false }).decode(encoded.subarray(0, maxBytes)).replace(/\uFFFD$/, "");
}

/** Blind grading prompt: the grader never sees which model wrote the answer. */
export function buildJudgeMessages(evaluationCase: AiEvaluationCase, output: string) {
  return [
    {
      role: "system" as const,
      content:
        "You are a strict, impartial evaluator of AI answers for a software team. Grade only against the " +
        "rubric. Penalize factual errors, missing required parts, invented facts, and padding. Respond with " +
        'a single JSON object: {"score": <integer 0-10>, "rationale": "<one or two sentences>"}.',
    },
    {
      role: "user" as const,
      content:
        `TASK GIVEN TO THE MODEL:\n${evaluationCase.prompt}\n\n` +
        `RUBRIC:\n${evaluationCase.rubric}\n\n` +
        `ANSWER TO GRADE:\n<<<\n${truncateUtf8(output, MAX_GRADED_ANSWER_BYTES)}\n>>>`,
    },
  ];
}

/** Parses the grader's JSON into a 0–1 score. Returns undefined when the grader misbehaved. */
export function parseJudgeVerdict(text: string): { score: number; rationale: string } | undefined {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[0]) as { score?: unknown; rationale?: unknown };
    // Only a number or a non-empty numeric string is a score; Number(null), Number(true), and
    // Number("") would otherwise turn a malformed verdict into a real (penalizing) score.
    const raw = typeof parsed.score === "number"
      ? parsed.score
      : typeof parsed.score === "string" && parsed.score.trim() !== ""
        ? Number(parsed.score)
        : NaN;
    if (!Number.isFinite(raw) || raw < 0 || raw > 10) return undefined;
    return {
      score: raw / 10,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 500) : "",
    };
  } catch {
    return undefined;
  }
}

function meanOfCaseMeans(records: AiModelEvaluationRecord[]) {
  const byCase = new Map<string, number[]>();
  for (const record of records) {
    const scores = byCase.get(record.caseId) ?? [];
    scores.push(record.status === "graded" ? record.qualityScore : 0);
    byCase.set(record.caseId, scores);
  }
  const caseMeans = [...byCase.values()].map((scores) => scores.reduce((sum, score) => sum + score, 0) / scores.length);
  return caseMeans.reduce((sum, mean) => sum + mean, 0) / caseMeans.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Failed attempts count as zero quality, so unreliable models are penalized, not ignored. Each
 * case weighs equally: retries can add many rows for the cases that grade cleanly, and averaging
 * raw rows would let those repeats outweigh a case the model is weak on.
 */
export function aggregateEvaluations(records: AiModelEvaluationRecord[]): AiModelAggregate[] {
  const byModel = new Map<string, AiModelEvaluationRecord[]>();
  for (const record of records) {
    const list = byModel.get(record.modelId) ?? [];
    list.push(record);
    byModel.set(record.modelId, list);
  }

  return [...byModel.entries()].map(([modelId, list]) => {
    const graded = list.filter((record) => record.status === "graded");
    return {
      modelId,
      sampleCount: list.length,
      coveredCaseIds: [...new Set(list.map((record) => record.caseId))].sort(),
      meanQuality: meanOfCaseMeans(list),
      medianLatencyMs: median(graded.map((record) => record.latencyMs)),
      lastEvaluatedAt: list.map((record) => record.evaluatedAt).sort().at(-1) ?? "",
    };
  });
}

function coversEveryCase(profile: AiTaskProfile, aggregate: AiModelAggregate) {
  return profile.evaluationCases.every((evaluationCase) => aggregate.coveredCaseIds.includes(evaluationCase.id));
}

/**
 * Models with complete evidence that scored below the ask's quality floor. Unlike a model whose
 * evidence is merely incomplete, these have been judged unfit and must stop serving.
 */
export function belowFloorModelIds(profile: AiTaskProfile, aggregates: AiModelAggregate[]): Set<string> {
  return new Set(
    aggregates
      .filter((aggregate) => coversEveryCase(profile, aggregate) && aggregate.meanQuality < profile.qualityFloor)
      .map((aggregate) => aggregate.modelId),
  );
}

/**
 * Ranks models for an ask using live catalog pricing. Quality comes from evaluations; cost is
 * recomputed from today's prices, so a price change re-ranks models without re-evaluating them.
 */
export function rankModels(
  profile: AiTaskProfile,
  aggregates: AiModelAggregate[],
  eligible: AiModelCandidate[],
): AiRankedModel[] {
  const candidates = new Map(eligible.map((candidate) => [candidate.id, candidate]));
  const { weights } = profile;
  const weightTotal = weights.quality + weights.cost + weights.latency;

  return aggregates
    .flatMap((aggregate): AiRankedModel[] => {
      const candidate = candidates.get(aggregate.modelId);
      if (!candidate) return [];
      // Qualify only on evidence from every case: repeated samples of one case must not stand in
      // for a case the grader kept failing on.
      if (!coversEveryCase(profile, aggregate)) return [];
      if (aggregate.meanQuality < profile.qualityFloor) return [];

      const estimatedRequestCostUsd = estimateRequestCostUsd(candidate, profile);
      const costScore = profile.referenceCostUsd / (profile.referenceCostUsd + estimatedRequestCostUsd);
      const latencyScore = profile.referenceLatencyMs / (profile.referenceLatencyMs + aggregate.medianLatencyMs);
      const qualityScore = aggregate.meanQuality;
      const fitScore =
        (weights.quality * qualityScore + weights.cost * costScore + weights.latency * latencyScore) / weightTotal;

      return [{
        modelId: aggregate.modelId,
        fitScore,
        meanQuality: aggregate.meanQuality,
        qualityScore,
        costScore,
        latencyScore,
        estimatedRequestCostUsd,
        medianLatencyMs: aggregate.medianLatencyMs,
        sampleCount: aggregate.sampleCount,
      }];
    })
    .sort((a, b) => b.fitScore - a.fitScore);
}

/**
 * Picks the primary model and fallbacks. Keeps the incumbent unless a challenger beats it by
 * SELECTION_SWITCH_MARGIN, so selections don't flap between near-identical models. When nothing
 * qualifies, the incumbent survives only while it is still eligible to serve (in the catalog,
 * unexpired, within budget) and has not been judged below the quality floor on complete
 * evidence; otherwise the ask falls back to the cold-start router.
 */
export function chooseSelection(
  profile: AiTaskProfile,
  ranked: AiRankedModel[],
  current: AiModelSelection | undefined,
  context: {
    runId: string;
    now: string;
    eligibleModelIds: ReadonlySet<string>;
    /** From belowFloorModelIds: never kept as the incumbent or a fallback. */
    belowFloorModelIds?: ReadonlySet<string>;
  },
): AiModelSelection {
  if (ranked.length === 0) {
    const retainable = (id: string) => context.eligibleModelIds.has(id) && !context.belowFloorModelIds?.has(id);
    if (current && retainable(current.modelId)) {
      return {
        taskKind: profile.kind,
        modelId: current.modelId,
        fallbackModelIds: current.fallbackModelIds.filter(retainable),
        fitScore: current.fitScore,
        reason: "No challenger qualified for this task; keeping the existing route.",
        runId: context.runId,
        selectedAt: context.now,
      };
    }
    return {
      taskKind: profile.kind,
      modelId: COLD_START_MODEL,
      fallbackModelIds: [],
      fitScore: null,
      reason: current && current.modelId !== COLD_START_MODEL
        ? context.belowFloorModelIds?.has(current.modelId)
          ? `${current.modelId} scored below the quality floor and no model has qualified; routing to ${COLD_START_MODEL}.`
          : `${current.modelId} is no longer eligible and no model has qualified; routing to ${COLD_START_MODEL}.`
        : "No model has qualified for this task yet; using the auto-router.",
      runId: context.runId,
      selectedAt: context.now,
    };
  }

  const best = ranked[0];
  const incumbent = current ? ranked.find((model) => model.modelId === current.modelId) : undefined;
  const keepIncumbent = incumbent !== undefined && best.fitScore - incumbent.fitScore < SELECTION_SWITCH_MARGIN;
  const primary = keepIncumbent ? incumbent : best;
  const fallbacks = ranked.filter((model) => model.modelId !== primary.modelId).slice(0, 2);

  const reason = keepIncumbent && incumbent.modelId !== best.modelId
    ? `Kept ${primary.modelId}: ${best.modelId} scored within the ${SELECTION_SWITCH_MARGIN} switch margin.`
    : `Best fit: quality ${primary.qualityScore.toFixed(2)}, ~$${primary.estimatedRequestCostUsd.toFixed(4)}/request, ` +
      `median ${Math.round(primary.medianLatencyMs)} ms.`;

  return {
    taskKind: profile.kind,
    modelId: primary.modelId,
    fallbackModelIds: fallbacks.map((model) => model.modelId),
    fitScore: primary.fitScore,
    reason,
    runId: context.runId,
    selectedAt: context.now,
  };
}
