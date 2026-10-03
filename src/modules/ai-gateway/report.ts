import { aggregateEvaluations, COLD_START_MODEL } from "@/modules/ai-gateway/scoring";
import { AI_TASK_PROFILES } from "@/modules/ai-gateway/task-profiles";
import { AiEvaluationRunSummary, AiGatewayRepository, AiTaskKind, aiTaskKinds } from "@/modules/ai-gateway/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AiModelReportRow {
  modelId: string;
  meanQuality: number;
  medianLatencyMs: number;
  meanCostUsd: number;
  sampleCount: number;
  lastEvaluatedAt: string;
}

export interface AiTaskReport {
  taskKind: AiTaskKind;
  label: string;
  description: string;
  weights: { quality: number; cost: number; latency: number };
  qualityFloor: number;
  selection: { modelId: string; fallbackModelIds: string[]; reason: string; selectedAt: string | null };
  leaderboard: AiModelReportRow[];
  usage: { requestCount: number; costUsd: number };
}

export interface AiModelReport {
  generatedAt: string;
  windowDays: number;
  tasks: AiTaskReport[];
  recentRuns: AiEvaluationRunSummary[];
}

/** Read model for the HQ "AI Models" view: what each ask routes to, and why. */
export async function buildAiModelReport(
  repository: AiGatewayRepository,
  options: { now: Date; windowDays: number; leaderboardSize?: number },
): Promise<AiModelReport> {
  const since = new Date(options.now.getTime() - options.windowDays * DAY_MS).toISOString();
  const [selections, usage, recentRuns] = await Promise.all([
    repository.listCurrentSelections(),
    repository.summarizeUsageSince(since),
    repository.listRecentRuns(10),
  ]);
  const selectionByKind = new Map(selections.map((selection) => [selection.taskKind, selection]));

  const tasks = await Promise.all(aiTaskKinds.map(async (kind): Promise<AiTaskReport> => {
    const profile = AI_TASK_PROFILES[kind];
    const records = await repository.listEvaluationsSince(kind, since);
    const costByModel = new Map<string, number[]>();
    for (const record of records) {
      if (record.status !== "graded") continue;
      const costs = costByModel.get(record.modelId) ?? [];
      costs.push(record.costUsd);
      costByModel.set(record.modelId, costs);
    }

    const leaderboard = aggregateEvaluations(records)
      .map((aggregate) => {
        const costs = costByModel.get(aggregate.modelId) ?? [];
        return {
          ...aggregate,
          meanCostUsd: costs.length ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length : 0,
        };
      })
      .sort((a, b) => b.meanQuality - a.meanQuality)
      .slice(0, options.leaderboardSize ?? 12);

    const selection = selectionByKind.get(kind);
    const taskUsage = usage.filter((row) => row.taskKind === kind);

    return {
      taskKind: kind,
      label: profile.label,
      description: profile.description,
      weights: profile.weights,
      qualityFloor: profile.qualityFloor,
      selection: selection
        ? {
            modelId: selection.modelId,
            fallbackModelIds: selection.fallbackModelIds,
            reason: selection.reason,
            selectedAt: selection.selectedAt,
          }
        : {
            modelId: COLD_START_MODEL,
            fallbackModelIds: [],
            reason: "Not evaluated yet — OpenRouter's auto-router picks per request.",
            selectedAt: null,
          },
      leaderboard,
      usage: {
        requestCount: taskUsage.reduce((sum, row) => sum + row.requestCount, 0),
        costUsd: taskUsage.reduce((sum, row) => sum + row.costUsd, 0),
      },
    };
  }));

  return { generatedAt: options.now.toISOString(), windowDays: options.windowDays, tasks, recentRuns };
}
