import { AiGatewayRepository, AiModelEvaluationRecord, AiModelSelection } from "@/modules/ai-gateway/types";

export const NOW = new Date("2026-10-03T12:00:00.000Z");

/** A raw OpenRouter /models entry. Prices are USD per token, as strings, like the real API. */
export function rawModel(
  id: string,
  options: {
    prompt?: string;
    completion?: string;
    context?: number;
    createdDaysAgo?: number;
    outputs?: string[];
    expiration?: string | null;
  } = {},
) {
  return {
    id,
    name: id,
    created: Math.floor((NOW.getTime() - (options.createdDaysAgo ?? 30) * 86_400_000) / 1000),
    context_length: options.context ?? 200_000,
    architecture: { input_modalities: ["text"], output_modalities: options.outputs ?? ["text"] },
    pricing: { prompt: options.prompt ?? "0.000001", completion: options.completion ?? "0.000005" },
    top_provider: { context_length: options.context ?? 200_000, max_completion_tokens: 32_000 },
    expiration_date: options.expiration ?? null,
  };
}

export function evaluation(overrides: Partial<AiModelEvaluationRecord> = {}): AiModelEvaluationRecord {
  return {
    runId: "run-1",
    taskKind: "hq_reasoning",
    caseId: "case-a",
    modelId: "anthropic/model-a",
    status: "graded",
    qualityScore: 0.9,
    judgeScore: 0.9,
    deterministicScore: 0.9,
    latencyMs: 10_000,
    promptTokens: 500,
    completionTokens: 800,
    costUsd: 0.004,
    graderModelId: "anthropic/grader",
    graderRationale: "Solid.",
    outputExcerpt: "answer",
    evaluatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

export class InMemoryAiGatewayRepository implements AiGatewayRepository {
  selections: AiModelSelection[] = [];
  evaluations: AiModelEvaluationRecord[] = [];
  runs: Parameters<AiGatewayRepository["recordRun"]>[0][] = [];
  usage: Parameters<AiGatewayRepository["recordUsage"]>[0][] = [];

  async listCurrentSelections() {
    const latest = new Map<string, AiModelSelection>();
    for (const selection of this.selections) {
      const existing = latest.get(selection.taskKind);
      if (!existing || existing.selectedAt <= selection.selectedAt) latest.set(selection.taskKind, selection);
    }
    return [...latest.values()];
  }
  async recordSelection(selection: AiModelSelection) {
    this.selections.push(selection);
  }
  async listEvaluationsSince(taskKind: string, since: string) {
    return this.evaluations.filter((record) => record.taskKind === taskKind && record.evaluatedAt >= since);
  }
  async recordEvaluations(records: AiModelEvaluationRecord[]) {
    this.evaluations.push(...records);
  }
  async recordRun(summary: Parameters<AiGatewayRepository["recordRun"]>[0]) {
    this.runs.push(summary);
  }
  async listRecentRuns(limit: number) {
    return this.runs.slice(-limit).reverse();
  }
  async recordUsage(record: Parameters<AiGatewayRepository["recordUsage"]>[0]) {
    this.usage.push(record);
  }
  async summarizeUsageSince(since: string) {
    const rows = new Map<string, { taskKind: AiModelSelection["taskKind"]; modelId: string; requestCount: number; costUsd: number }>();
    for (const record of this.usage.filter((entry) => entry.createdAt >= since)) {
      const key = `${record.taskKind}|${record.modelId}`;
      const row = rows.get(key) ?? { taskKind: record.taskKind, modelId: record.modelId, requestCount: 0, costUsd: 0 };
      row.requestCount += 1;
      row.costUsd += record.costUsd ?? 0;
      rows.set(key, row);
    }
    return [...rows.values()];
  }
}
