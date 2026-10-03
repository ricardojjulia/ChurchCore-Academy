import { eligibleCandidates, normalizeOpenRouterCatalog } from "@/modules/ai-gateway/catalog";
import type { OpenRouterClient } from "@/modules/ai-gateway/openrouter-client";
import {
  aggregateEvaluations,
  belowFloorModelIds,
  buildJudgeMessages,
  chooseSelection,
  COLD_START_MODEL,
  combineQuality,
  MAX_GRADED_ANSWER_BYTES,
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
const MESSAGE_OVERHEAD_TOKENS = 16;
const utf8 = new TextEncoder();

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

/**
 * Upper bound on prompt tokens for budget reservations. Byte-level BPE tokenizers (every model
 * family the evaluator considers) never emit more than one token per UTF-8 byte, so this holds for
 * code, punctuation, and non-Latin text, unlike an average chars-per-token estimate.
 */
function maxPromptTokens(texts: string[]) {
  const bytes = texts.reduce((total, text) => total + utf8.encode(text).length, 0);
  return bytes + MESSAGE_OVERHEAD_TOKENS * texts.length;
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
    worstCaseGradeCostUsd(grader, evaluationCase), 0);
}

function worstCaseAnswerCostUsd(candidate: AiModelCandidate, profile: AiTaskProfile, evaluationCase: AiEvaluationCase) {
  const promptTokens = maxPromptTokens([evaluationCase.system, evaluationCase.prompt]);
  return callCost(candidate, promptTokens, evaluationOutputTokens(profile));
}

function worstCaseGradeCostUsd(grader: AiModelCandidate, evaluationCase: AiEvaluationCase) {
  const judgeFrame = buildJudgeMessages(evaluationCase, "").map((message) => message.content);
  // The graded answer is cut to MAX_GRADED_ANSWER_BYTES, so it adds at most that many grader tokens.
  const promptTokens = maxPromptTokens(judgeFrame) + MAX_GRADED_ANSWER_BYTES;
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

  // The run, its evaluations, and its selections are written together in one transaction, so a
  // failure part-way never leaves evaluations or a live selection without the run that explains it.
  const finish = async (
    status: AiEvaluationRunSummary["status"],
    evaluations: AiModelEvaluationRecord[],
    selections: AiModelSelection[],
    selectionChanges: AiEvaluationRunSummary["selectionChanges"],
  ) => {
    const summary: AiEvaluationRunSummary = {
      runId,
      startedAt: startedAt.toISOString(),
      finishedAt: now().toISOString(),
      status,
      spentUsd: Number(spentUsd.toFixed(6)),
      evaluatedModelCount: new Set(evaluations.map((record) => `${record.taskKind}:${record.modelId}`)).size,
      selectionChanges,
    };
    await repository.finalizeRun(summary, evaluations, selections);
    return summary;
  };

  const catalog = normalizeOpenRouterCatalog(await client.listModels());
  const grader = catalog.find((candidate) => candidate.id === options.graderModel);
  const kinds = options.taskKinds ?? [...aiTaskKinds];
  const currentSelections = new Map((await repository.listCurrentSelections()).map((selection) => [selection.taskKind, selection]));

  if (!grader) {
    // Nothing can be graded, but a route the catalog no longer supports (delisted, expiring, over
    // the price ceiling) must still fall back to the auto-router rather than keep serving.
    const selectedAt = now().toISOString();
    const invalidated: AiModelSelection[] = [];
    const changes: AiEvaluationRunSummary["selectionChanges"] = [];
    for (const kind of kinds) {
      const current = currentSelections.get(kind);
      if (!current || current.modelId === COLD_START_MODEL) continue;
      const profile = AI_TASK_PROFILES[kind];
      const eligibleModelIds = new Set(eligibleCandidates(catalog, profile, {
        now: startedAt,
        providerPrefixes: options.providerPrefixes,
        maxAgeDays: options.maxModelAgeDays,
      }).map((candidate) => candidate.id));
      if (eligibleModelIds.has(current.modelId)) continue;
      const next = chooseSelection(profile, [], current, { runId, now: selectedAt, eligibleModelIds });
      invalidated.push(next);
      changes.push({ taskKind: kind, from: current.modelId, to: next.modelId });
    }
    return finish("failed", [], invalidated, changes);
  }
  const windowStart = new Date(startedAt.getTime() - options.windowDays * DAY_MS).toISOString();

  const eligibleByKind = new Map<AiTaskKind, AiModelCandidate[]>();
  const historyByKind = new Map<AiTaskKind, AiModelEvaluationRecord[]>();
  const jobs: EvaluationJob[] = [];
  let budgetExcludedTargets = false;

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

    // A model whose worst case can never fit one run's budget is left out of planning entirely;
    // planning it would take a slot every run and starve affordable models (it still ranks on any
    // evidence it already has).
    const affordable = eligible.filter((candidate) => worstCaseJobCostUsd(candidate, grader, profile) <= options.budgetUsd);
    const planOptions = {
      now: startedAt,
      staleAfterDays: options.staleAfterDays,
      modelsPerTask: options.modelsPerTask,
      requiredCaseIds: profile.evaluationCases.map((evaluationCase) => evaluationCase.id),
    };
    const targets = planEvaluationTargets(affordable, history, currentSelections.get(kind), planOptions);
    // Still report that the budget limited this run when it kept out a model that was due.
    if (planEvaluationTargets(eligible, history, currentSelections.get(kind), planOptions)
      .some((candidate) => !affordable.includes(candidate))) {
      budgetExcludedTargets = true;
    }
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
      spentUsd += chargedCostUsd(grader, judged.usage, worstCaseGradeCostUsd(grader, evaluationCase));
      verdict = parseJudgeVerdict(judged.text);
    } catch {
      spentUsd += worstCaseGradeCostUsd(grader, evaluationCase);
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
  const pending = [...jobs];
  let inFlight = 0;
  let deadlineHit = false;
  let budgetHit = budgetExcludedTargets;
  let releaseWaiters: Array<() => void> = [];
  const waitForRelease = () => new Promise<void>((resolve) => releaseWaiters.push(resolve));

  /**
   * Takes the next job that fits both the deadline and the remaining budget. A job that only
   * fails to fit because of other jobs' in-flight reservations is not given up on: the worker waits
   * for a reservation to be released and looks again. Only work that can't fit even with nothing
   * else running is dropped, so a big job never stops cheaper ones behind it.
   */
  const takeJob = async (): Promise<{ job: EvaluationJob; reservation: number } | undefined> => {
    while (pending.length > 0) {
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        if (now().getTime() + pending[index].profile.evaluationTimeoutMs + options.graderTimeoutMs > deadline) {
          pending.splice(index, 1);
          deadlineHit = true;
        }
      }
      let blockedByInFlight = false;
      for (let index = 0; index < pending.length; index += 1) {
        const job = pending[index];
        const reservation = worstCaseJobCostUsd(job.candidate, grader, job.profile);
        if (spentUsd + reservedUsd + reservation <= options.budgetUsd) {
          pending.splice(index, 1);
          // Commit the reservation before yielding, so the next worker's check already sees it.
          inFlight += 1;
          reservedUsd += reservation;
          return { job, reservation };
        }
        if (spentUsd + reservation <= options.budgetUsd) blockedByInFlight = true;
      }
      if (blockedByInFlight && inFlight > 0) {
        await waitForRelease();
        continue;
      }
      if (pending.length > 0) budgetHit = true;
      pending.length = 0;
    }
    return undefined;
  };

  const worker = async () => {
    for (let next = await takeJob(); next; next = await takeJob()) {
      const { job, reservation } = next;
      try {
        const records = await Promise.all(job.profile.evaluationCases.map((evaluationCase) => evaluateCase(job, evaluationCase)));
        newRecords.push(...records.filter((record): record is AiModelEvaluationRecord => record !== undefined));
      } finally {
        inFlight -= 1;
        reservedUsd -= reservation;
        const waiters = releaseWaiters;
        releaseWaiters = [];
        waiters.forEach((resolve) => resolve());
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, () => worker()));
  const stopReason: AiEvaluationRunSummary["status"] = deadlineHit
    ? "deadline_reached"
    : budgetHit
      ? "budget_exhausted"
      : "completed";

  const selectionChanges: AiEvaluationRunSummary["selectionChanges"] = [];
  const selections: AiModelSelection[] = [];
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

    // A changed rationale is a new snapshot too, so the report never shows a stale explanation.
    const changed = !current ||
      current.modelId !== next.modelId ||
      current.fallbackModelIds.join(",") !== next.fallbackModelIds.join(",") ||
      current.reason !== next.reason;
    if (!changed) continue;

    selections.push(next);
    if ((current?.modelId ?? COLD_START_MODEL) !== next.modelId) {
      selectionChanges.push({ taskKind: kind, from: current?.modelId ?? null, to: next.modelId });
    }
  }

  return finish(stopReason, newRecords, selections, selectionChanges);
}
