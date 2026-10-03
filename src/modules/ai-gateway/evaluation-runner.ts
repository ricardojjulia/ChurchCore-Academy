import { eligibleCandidates, estimateRequestCostUsd, normalizeOpenRouterCatalog } from "@/modules/ai-gateway/catalog";
import type { OpenRouterClient } from "@/modules/ai-gateway/openrouter-client";
import {
  aggregateEvaluations,
  buildJudgeMessages,
  chooseSelection,
  COLD_START_MODEL,
  combineQuality,
  parseJudgeVerdict,
  rankModels,
  scoreDeterministic,
} from "@/modules/ai-gateway/scoring";
import { AI_TASK_PROFILES } from "@/modules/ai-gateway/task-profiles";
import {
  AiEvaluationCase,
  AiEvaluationRunSummary,
  AiGatewayRepository,
  AiModelCandidate,
  AiModelEvaluationRecord,
  AiModelSelection,
  AiTaskKind,
  AiTaskProfile,
  aiTaskKinds,
} from "@/modules/ai-gateway/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const EVALUATION_MAX_OUTPUT_TOKENS = 4_000;
const EXCERPT_LENGTH = 2_000;

export interface EvaluationRunnerDependencies {
  client: Pick<OpenRouterClient, "listModels" | "complete">;
  repository: AiGatewayRepository;
  now?: () => Date;
  randomId?: () => string;
}

export interface EvaluationRunOptions {
  graderModel: string;
  /** Hard cap on what one run may spend (candidate + grader calls), in USD. */
  budgetUsd: number;
  /**
   * Wall-clock limit for the whole run. A job only starts if its worst case (answer timeout +
   * grader timeout) still finishes inside it, so the run never outlives its function.
   */
  deadlineMs: number;
  /** Models evaluated per task kind per run (the incumbent re-check counts toward this). */
  modelsPerTask: number;
  providerPrefixes: string[];
  maxModelAgeDays: number;
  /** Re-evaluate a model whose newest sample is older than this. */
  staleAfterDays: number;
  /** Evaluations older than this are ignored when ranking. */
  windowDays: number;
  concurrency: number;
  /** Timeout for each grader call; candidate answers use the profile's evaluationTimeoutMs. */
  graderTimeoutMs: number;
  taskKinds?: AiTaskKind[];
}

export const DEFAULT_EVALUATION_OPTIONS: Omit<EvaluationRunOptions, "graderModel" | "providerPrefixes"> = {
  budgetUsd: 0.5,
  // Under the cron's 300s maxDuration, leaving headroom for catalog load and persistence.
  deadlineMs: 270_000,
  modelsPerTask: 2,
  maxModelAgeDays: 365,
  staleAfterDays: 21,
  windowDays: 60,
  concurrency: 4,
  graderTimeoutMs: 60_000,
};

/**
 * Round-robins an already-ordered list across providers (the id prefix before "/"), so one
 * provider's burst of new releases can't monopolize a run's few evaluation slots.
 */
export function interleaveProviders(candidates: AiModelCandidate[]): AiModelCandidate[] {
  const queues = new Map<string, AiModelCandidate[]>();
  for (const candidate of candidates) {
    const provider = candidate.id.split("/")[0];
    const queue = queues.get(provider) ?? [];
    queue.push(candidate);
    queues.set(provider, queue);
  }
  const result: AiModelCandidate[] = [];
  while (result.length < candidates.length) {
    for (const queue of queues.values()) {
      const next = queue.shift();
      if (next) result.push(next);
    }
  }
  return result;
}

interface EvaluationJob {
  profile: AiTaskProfile;
  candidate: AiModelCandidate;
}

/**
 * Which models to try for one ask this run: the incumbent when its evidence is stale, then
 * never-evaluated models (newest releases first), then the stalest evaluated models.
 */
export function planEvaluationTargets(
  eligible: AiModelCandidate[],
  history: AiModelEvaluationRecord[],
  current: AiModelSelection | undefined,
  options: { now: Date; staleAfterDays: number; modelsPerTask: number },
): AiModelCandidate[] {
  const lastEvaluated = new Map<string, number>();
  for (const record of history) {
    const at = Date.parse(record.evaluatedAt);
    if (at > (lastEvaluated.get(record.modelId) ?? 0)) lastEvaluated.set(record.modelId, at);
  }
  const staleBefore = options.now.getTime() - options.staleAfterDays * DAY_MS;
  const isStale = (id: string) => (lastEvaluated.get(id) ?? 0) < staleBefore;

  const targets: AiModelCandidate[] = [];
  const incumbent = current ? eligible.find((candidate) => candidate.id === current.modelId) : undefined;
  if (incumbent && isStale(incumbent.id)) targets.push(incumbent);

  const unseen = interleaveProviders(
    eligible
      .filter((candidate) => !lastEvaluated.has(candidate.id) && candidate.id !== incumbent?.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id)),
  );
  const stale = eligible
    .filter((candidate) => lastEvaluated.has(candidate.id) && isStale(candidate.id) && candidate.id !== incumbent?.id)
    .sort((a, b) => (lastEvaluated.get(a.id) ?? 0) - (lastEvaluated.get(b.id) ?? 0));

  for (const candidate of [...unseen, ...stale]) {
    if (targets.length >= options.modelsPerTask) break;
    targets.push(candidate);
  }
  return targets.slice(0, options.modelsPerTask);
}

function callCost(candidate: AiModelCandidate, promptTokens: number, completionTokens: number) {
  return (candidate.promptUsdPerMillion * promptTokens + candidate.completionUsdPerMillion * completionTokens) / 1_000_000;
}

function estimateGraderCostUsd(grader: AiModelCandidate, profile: AiTaskProfile) {
  return callCost(grader, profile.typicalCompletionTokens + 800, 250);
}

export async function runModelEvaluation(
  dependencies: EvaluationRunnerDependencies,
  options: EvaluationRunOptions,
): Promise<AiEvaluationRunSummary> {
  const now = dependencies.now ?? (() => new Date());
  const randomId = dependencies.randomId ?? (() => crypto.randomUUID());
  const { client, repository } = dependencies;

  const runId = randomId();
  const startedAt = now();
  const deadline = startedAt.getTime() + options.deadlineMs;
  let spentUsd = 0;
  let reservedUsd = 0;
  let stopReason: AiEvaluationRunSummary["status"] = "completed";

  const finish = async (
    status: AiEvaluationRunSummary["status"],
    evaluatedModelCount: number,
    selectionChanges: AiEvaluationRunSummary["selectionChanges"],
  ) => {
    const summary: AiEvaluationRunSummary = {
      runId,
      startedAt: startedAt.toISOString(),
      finishedAt: now().toISOString(),
      status,
      spentUsd: Number(spentUsd.toFixed(6)),
      evaluatedModelCount,
      selectionChanges,
    };
    await repository.recordRun(summary);
    return summary;
  };

  const catalog = normalizeOpenRouterCatalog(await client.listModels());
  const grader = catalog.find((candidate) => candidate.id === options.graderModel);
  if (!grader) {
    return finish("failed", 0, []);
  }

  const kinds = options.taskKinds ?? [...aiTaskKinds];
  const currentSelections = new Map((await repository.listCurrentSelections()).map((selection) => [selection.taskKind, selection]));
  const windowStart = new Date(startedAt.getTime() - options.windowDays * DAY_MS).toISOString();

  const eligibleByKind = new Map<AiTaskKind, AiModelCandidate[]>();
  const historyByKind = new Map<AiTaskKind, AiModelEvaluationRecord[]>();
  const jobs: EvaluationJob[] = [];

  for (const kind of kinds) {
    const profile = AI_TASK_PROFILES[kind];
    // The grader judges every ask, so it never competes in one (self-preference bias).
    const eligible = eligibleCandidates(catalog, profile, {
      now: startedAt,
      providerPrefixes: options.providerPrefixes,
      maxAgeDays: options.maxModelAgeDays,
    }).filter((candidate) => candidate.id !== grader.id);
    const history = await repository.listEvaluationsSince(kind, windowStart);
    eligibleByKind.set(kind, eligible);
    historyByKind.set(kind, history);

    const targets = planEvaluationTargets(eligible, history, currentSelections.get(kind), {
      now: startedAt,
      staleAfterDays: options.staleAfterDays,
      modelsPerTask: options.modelsPerTask,
    });
    for (const candidate of targets) jobs.push({ profile, candidate });
  }
  // Longest-running asks first, so they start while the most wall-clock time remains.
  jobs.sort((a, b) => b.profile.evaluationTimeoutMs - a.profile.evaluationTimeoutMs);

  const evaluateCase = async (job: EvaluationJob, evaluationCase: AiEvaluationCase): Promise<AiModelEvaluationRecord | undefined> => {
    const base = {
      runId,
      taskKind: job.profile.kind,
      caseId: evaluationCase.id,
      modelId: job.candidate.id,
      graderModelId: grader.id,
    };

    let answer;
    try {
      answer = await client.complete({
        model: job.candidate.id,
        messages: [
          { role: "system", content: evaluationCase.system },
          { role: "user", content: evaluationCase.prompt },
        ],
        maxTokens: Math.min(job.profile.maxOutputTokens, EVALUATION_MAX_OUTPUT_TOKENS),
        timeoutMs: job.profile.evaluationTimeoutMs,
      });
    } catch {
      return {
        ...base,
        status: "failed",
        qualityScore: 0,
        judgeScore: 0,
        deterministicScore: 0,
        latencyMs: job.profile.evaluationTimeoutMs,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        graderRationale: "Model request failed or timed out.",
        outputExcerpt: "",
        evaluatedAt: now().toISOString(),
      };
    }

    const answerCost = answer.usage.costUsd ??
      callCost(job.candidate, answer.usage.promptTokens, answer.usage.completionTokens);
    spentUsd += answerCost;

    let verdict;
    try {
      const judged = await client.complete({
        model: grader.id,
        messages: buildJudgeMessages(evaluationCase, answer.text),
        maxTokens: 400,
        temperature: 0,
        jsonResponse: true,
        timeoutMs: options.graderTimeoutMs,
      });
      spentUsd += judged.usage.costUsd ?? callCost(grader, judged.usage.promptTokens, judged.usage.completionTokens);
      verdict = parseJudgeVerdict(judged.text);
    } catch {
      verdict = undefined;
    }

    // A grader failure is not the candidate's fault: drop the sample rather than score it zero.
    if (!verdict) return undefined;

    const deterministicScore = scoreDeterministic(answer.text, evaluationCase);
    return {
      ...base,
      status: "graded",
      qualityScore: combineQuality(verdict.score, deterministicScore),
      judgeScore: verdict.score,
      deterministicScore,
      latencyMs: answer.latencyMs,
      promptTokens: answer.usage.promptTokens,
      completionTokens: answer.usage.completionTokens,
      costUsd: Number(answerCost.toFixed(6)),
      graderRationale: verdict.rationale,
      outputExcerpt: answer.text.slice(0, EXCERPT_LENGTH),
      evaluatedAt: now().toISOString(),
    };
  };

  const newRecords: AiModelEvaluationRecord[] = [];
  const evaluatedModels = new Set<string>();
  let nextJob = 0;

  const worker = async () => {
    while (nextJob < jobs.length && stopReason === "completed") {
      const job = jobs[nextJob];
      if (now().getTime() + job.profile.evaluationTimeoutMs + options.graderTimeoutMs > deadline) {
        stopReason = "deadline_reached";
        return;
      }
      const reservation = job.profile.evaluationCases.length *
        (estimateRequestCostUsd(job.candidate, job.profile) + estimateGraderCostUsd(grader, job.profile));
      if (spentUsd + reservedUsd + reservation > options.budgetUsd) {
        stopReason = "budget_exhausted";
        return;
      }
      nextJob += 1;
      reservedUsd += reservation;
      try {
        const records = await Promise.all(job.profile.evaluationCases.map((evaluationCase) => evaluateCase(job, evaluationCase)));
        const kept = records.filter((record): record is AiModelEvaluationRecord => record !== undefined);
        if (kept.length > 0) {
          await repository.recordEvaluations(kept);
          newRecords.push(...kept);
          evaluatedModels.add(`${job.profile.kind}:${job.candidate.id}`);
        }
      } finally {
        reservedUsd -= reservation;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, () => worker()));

  const selectionChanges: AiEvaluationRunSummary["selectionChanges"] = [];
  const selectedAt = now().toISOString();

  for (const kind of kinds) {
    const profile = AI_TASK_PROFILES[kind];
    const history = [...(historyByKind.get(kind) ?? []), ...newRecords.filter((record) => record.taskKind === kind)];
    const ranked = rankModels(profile, aggregateEvaluations(history), eligibleByKind.get(kind) ?? []);
    const current = currentSelections.get(kind);
    const next = chooseSelection(profile, ranked, current, { runId, now: selectedAt });

    // Nothing qualified and nothing was selected before: the gateway already cold-starts on
    // COLD_START_MODEL, so there is no selection to record.
    if (!current && ranked.length === 0) continue;

    const changed = !current ||
      current.modelId !== next.modelId ||
      current.fallbackModelIds.join(",") !== next.fallbackModelIds.join(",");
    if (!changed) continue;

    await repository.recordSelection(next);
    if ((current?.modelId ?? COLD_START_MODEL) !== next.modelId) {
      selectionChanges.push({ taskKind: kind, from: current?.modelId ?? null, to: next.modelId });
    }
  }

  return finish(stopReason, evaluatedModels.size, selectionChanges);
}
