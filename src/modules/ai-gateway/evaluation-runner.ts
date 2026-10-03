import { eligibleCandidates, normalizeOpenRouterCatalog } from "@/modules/ai-gateway/catalog";
import type { OpenRouterClient } from "@/modules/ai-gateway/openrouter-client";
import {
  aggregateEvaluations,
  belowFloorModelIds,
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
  AiEvaluationInProgressError,
  AiModelSelection,
  AiTaskKind,
  AiTaskProfile,
  aiTaskKinds,
} from "@/modules/ai-gateway/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const EVALUATION_MAX_OUTPUT_TOKENS = 4_000;
const GRADER_MAX_OUTPUT_TOKENS = 400;
const EXCERPT_LENGTH = 2_000;
/** The lease outlives the run's deadline by this much, covering catalog load and persistence. */
const LEASE_HEADROOM_MS = 60_000;
/** Conservative token estimate for budget reservations: real tokenizers average ~4 chars/token. */
const CHARS_PER_TOKEN_FLOOR = 3;
const MESSAGE_OVERHEAD_TOKENS = 16;

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
 * Which models to try for one ask this run: the incumbent when its evidence is stale or
 * incomplete, then models missing coverage of a required case (a dropped grader sample must not
 * strand a model for weeks), then never-evaluated models (newest releases first), then the
 * stalest evaluated models.
 */
export function planEvaluationTargets(
  eligible: AiModelCandidate[],
  history: AiModelEvaluationRecord[],
  current: AiModelSelection | undefined,
  options: { now: Date; staleAfterDays: number; modelsPerTask: number; requiredCaseIds: string[] },
): AiModelCandidate[] {
  const lastEvaluated = new Map<string, number>();
  const coveredCases = new Map<string, Set<string>>();
  for (const record of history) {
    const at = Date.parse(record.evaluatedAt);
    if (at > (lastEvaluated.get(record.modelId) ?? 0)) lastEvaluated.set(record.modelId, at);
    const covered = coveredCases.get(record.modelId) ?? new Set<string>();
    covered.add(record.caseId);
    coveredCases.set(record.modelId, covered);
  }
  const staleBefore = options.now.getTime() - options.staleAfterDays * DAY_MS;
  const isStale = (id: string) => (lastEvaluated.get(id) ?? 0) < staleBefore;
  const isIncomplete = (id: string) => {
    const covered = coveredCases.get(id);
    return covered !== undefined && options.requiredCaseIds.some((caseId) => !covered.has(caseId));
  };

  const targets: AiModelCandidate[] = [];
  const incumbent = current ? eligible.find((candidate) => candidate.id === current.modelId) : undefined;
  if (incumbent && (isStale(incumbent.id) || isIncomplete(incumbent.id))) targets.push(incumbent);

  const incomplete = eligible
    .filter((candidate) => candidate.id !== incumbent?.id && isIncomplete(candidate.id) && !isStale(candidate.id))
    .sort((a, b) => (lastEvaluated.get(a.id) ?? 0) - (lastEvaluated.get(b.id) ?? 0));
  const unseen = interleaveProviders(
    eligible
      .filter((candidate) => !lastEvaluated.has(candidate.id) && candidate.id !== incumbent?.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id)),
  );
  const stale = eligible
    .filter((candidate) => lastEvaluated.has(candidate.id) && isStale(candidate.id) && candidate.id !== incumbent?.id)
    .sort((a, b) => (lastEvaluated.get(a.id) ?? 0) - (lastEvaluated.get(b.id) ?? 0));

  for (const candidate of [...incomplete, ...unseen, ...stale]) {
    if (targets.length >= options.modelsPerTask) break;
    targets.push(candidate);
  }
  return targets.slice(0, options.modelsPerTask);
}

function callCost(candidate: AiModelCandidate, promptTokens: number, completionTokens: number) {
  return (candidate.promptUsdPerMillion * promptTokens + candidate.completionUsdPerMillion * completionTokens) / 1_000_000;
}

function maxTokensForChars(chars: number) {
  return Math.ceil(chars / CHARS_PER_TOKEN_FLOOR) + MESSAGE_OVERHEAD_TOKENS * 2;
}

function evaluationOutputTokens(profile: AiTaskProfile) {
  return Math.min(profile.maxOutputTokens, EVALUATION_MAX_OUTPUT_TOKENS);
}

/**
 * Worst-case spend for one model on one ask: every case answered at the full output-token limit,
 * then graded with that full answer in the grader prompt and the grader's full output limit. The
 * run reserves this before dispatch, so the budget is a hard cap rather than a typical-case guess.
 */
export function worstCaseJobCostUsd(candidate: AiModelCandidate, grader: AiModelCandidate, profile: AiTaskProfile) {
  return profile.evaluationCases.reduce((total, evaluationCase) =>
    total +
    worstCaseAnswerCostUsd(candidate, profile, evaluationCase) +
    worstCaseGradeCostUsd(grader, profile, evaluationCase), 0);
}

function worstCaseAnswerCostUsd(candidate: AiModelCandidate, profile: AiTaskProfile, evaluationCase: AiEvaluationCase) {
  const promptTokens = maxTokensForChars(evaluationCase.system.length + evaluationCase.prompt.length);
  return callCost(candidate, promptTokens, evaluationOutputTokens(profile));
}

function worstCaseGradeCostUsd(grader: AiModelCandidate, profile: AiTaskProfile, evaluationCase: AiEvaluationCase) {
  const judgeFrameChars = buildJudgeMessages(evaluationCase, "")
    .reduce((chars, message) => chars + message.content.length, 0);
  const promptTokens = maxTokensForChars(judgeFrameChars) + evaluationOutputTokens(profile);
  return callCost(grader, promptTokens, GRADER_MAX_OUTPUT_TOKENS);
}

/**
 * What a call counts against the budget. A failed or timed-out request may still be billed, and a
 * response without usage tells us nothing, so both are charged at the worst case rather than zero;
 * otherwise repeated failures would free budget that later jobs could overspend.
 */
function chargedCostUsd(
  model: AiModelCandidate,
  usage: { promptTokens: number; completionTokens: number; costUsd?: number } | undefined,
  worstCaseUsd: number,
) {
  if (usage?.costUsd !== undefined) return usage.costUsd;
  if (usage && (usage.promptTokens > 0 || usage.completionTokens > 0)) {
    return callCost(model, usage.promptTokens, usage.completionTokens);
  }
  return worstCaseUsd;
}

/**
 * Runs one evaluation cycle under the global evaluation lease. Throws AiEvaluationInProgressError
 * when another run (cron or admin-triggered) holds it, so overlapping runs never read the same
 * incumbent, spend separate budgets, or append conflicting selections.
 */
export async function runModelEvaluation(
  dependencies: EvaluationRunnerDependencies,
  options: EvaluationRunOptions,
): Promise<AiEvaluationRunSummary> {
  const now = dependencies.now ?? (() => new Date());
  const runId = (dependencies.randomId ?? (() => crypto.randomUUID()))();
  const startedAt = now();
  const leaseExpiresAt = new Date(startedAt.getTime() + options.deadlineMs + LEASE_HEADROOM_MS);

  const acquired = await dependencies.repository.acquireEvaluationLease(
    runId,
    startedAt.toISOString(),
    leaseExpiresAt.toISOString(),
  );
  if (!acquired) throw new AiEvaluationInProgressError();

  try {
    return await evaluateUnderLease(dependencies, options, runId, startedAt, now);
  } finally {
    await dependencies.repository.releaseEvaluationLease(runId).catch(() => {
      // An unreleased lease expires on its own; never mask the run's own outcome.
    });
  }
}

async function evaluateUnderLease(
  dependencies: EvaluationRunnerDependencies,
  options: EvaluationRunOptions,
  runId: string,
  startedAt: Date,
  now: () => Date,
): Promise<AiEvaluationRunSummary> {
  const { client, repository } = dependencies;
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
      requiredCaseIds: profile.evaluationCases.map((evaluationCase) => evaluationCase.id),
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
        maxTokens: evaluationOutputTokens(job.profile),
        timeoutMs: job.profile.evaluationTimeoutMs,
      });
    } catch {
      spentUsd += worstCaseAnswerCostUsd(job.candidate, job.profile, evaluationCase);
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

    // The record keeps the known cost (what the report averages); the budget is charged conservatively.
    const answerCost = answer.usage.costUsd ??
      callCost(job.candidate, answer.usage.promptTokens, answer.usage.completionTokens);
    spentUsd += chargedCostUsd(
      job.candidate,
      answer.usage,
      worstCaseAnswerCostUsd(job.candidate, job.profile, evaluationCase),
    );

    let verdict;
    try {
      const judged = await client.complete({
        model: grader.id,
        messages: buildJudgeMessages(evaluationCase, answer.text),
        maxTokens: GRADER_MAX_OUTPUT_TOKENS,
        temperature: 0,
        jsonResponse: true,
        timeoutMs: options.graderTimeoutMs,
      });
      spentUsd += chargedCostUsd(grader, judged.usage, worstCaseGradeCostUsd(grader, job.profile, evaluationCase));
      verdict = parseJudgeVerdict(judged.text);
    } catch {
      spentUsd += worstCaseGradeCostUsd(grader, job.profile, evaluationCase);
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
      const reservation = worstCaseJobCostUsd(job.candidate, grader, job.profile);
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
    const aggregates = aggregateEvaluations(history);
    const ranked = rankModels(profile, aggregates, eligibleByKind.get(kind) ?? []);
    const current = currentSelections.get(kind);
    const eligibleModelIds = new Set((eligibleByKind.get(kind) ?? []).map((candidate) => candidate.id));
    const next = chooseSelection(profile, ranked, current, {
      runId,
      now: selectedAt,
      eligibleModelIds,
      belowFloorModelIds: belowFloorModelIds(profile, aggregates),
    });

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
