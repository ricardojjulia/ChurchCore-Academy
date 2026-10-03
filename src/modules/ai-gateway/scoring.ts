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
        `ANSWER TO GRADE:\n<<<\n${output.slice(0, 24_000)}\n>>>`,
    },
  ];
}

/** Parses the grader's JSON into a 0–1 score. Returns undefined when the grader misbehaved. */
export function parseJudgeVerdict(text: string): { score: number; rationale: string } | undefined {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[0]) as { score?: unknown; rationale?: unknown };
    const raw = typeof parsed.score === "number" ? parsed.score : Number(parsed.score);
    if (!Number.isFinite(raw) || raw < 0 || raw > 10) return undefined;
    return {
      score: raw / 10,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 500) : "",
    };
  } catch {
    return undefined;
  }
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Failed attempts count as zero quality, so unreliable models are penalized, not ignored. */
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
      meanQuality: list.reduce((sum, record) => sum + (record.status === "graded" ? record.qualityScore : 0), 0) / list.length,
      medianLatencyMs: median(graded.map((record) => record.latencyMs)),
      lastEvaluatedAt: list.map((record) => record.evaluatedAt).sort().at(-1) ?? "",
    };
  });
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
  const minSamples = Math.min(2, profile.evaluationCases.length);
  const { weights } = profile;
  const weightTotal = weights.quality + weights.cost + weights.latency;

  return aggregates
    .flatMap((aggregate): AiRankedModel[] => {
      const candidate = candidates.get(aggregate.modelId);
      if (!candidate) return [];
      if (aggregate.sampleCount < minSamples || aggregate.meanQuality < profile.qualityFloor) return [];

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
 * unexpired, within budget); otherwise the ask falls back to the cold-start router.
 */
export function chooseSelection(
  profile: AiTaskProfile,
  ranked: AiRankedModel[],
  current: AiModelSelection | undefined,
  context: { runId: string; now: string; eligibleModelIds: ReadonlySet<string> },
): AiModelSelection {
  if (ranked.length === 0) {
    const incumbentEligible = current !== undefined && context.eligibleModelIds.has(current.modelId);
    if (current && incumbentEligible) {
      return {
        taskKind: profile.kind,
        modelId: current.modelId,
        fallbackModelIds: current.fallbackModelIds.filter((id) => context.eligibleModelIds.has(id)),
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
        ? `${current.modelId} is no longer eligible and no model has qualified; routing to ${COLD_START_MODEL}.`
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
