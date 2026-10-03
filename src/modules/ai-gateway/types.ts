// Shared types for the OpenRouter AI gateway (ADR 0078). Every LLM call in Academy goes through
// this module: no route or component talks to a model provider directly.

export const aiTaskKinds = [
  "hq_council_review",
  "hq_reasoning",
  "hq_engineering",
  "hq_writing",
] as const;

export type AiTaskKind = (typeof aiTaskKinds)[number];

export type AiChatRole = "system" | "user" | "assistant";

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

/** A model from the OpenRouter catalog, normalized to USD per million tokens. */
export interface AiModelCandidate {
  id: string;
  name: string;
  contextLength: number;
  maxCompletionTokens?: number;
  promptUsdPerMillion: number;
  completionUsdPerMillion: number;
  createdAt: string;
  expiresAt?: string;
}

/** A synthetic evaluation case. Never contains tenant data. */
export interface AiEvaluationCase {
  id: string;
  system: string;
  prompt: string;
  /** What a strong answer does — given to the grader model verbatim. */
  rubric: string;
  /** Deterministic checks: case-insensitive terms a usable answer must mention. */
  requiredTerms: string[];
  maxWords: number;
}

export interface AiScoringWeights {
  quality: number;
  cost: number;
  latency: number;
}

export interface AiTaskProfile {
  kind: AiTaskKind;
  label: string;
  description: string;
  weights: AiScoringWeights;
  /** A model whose mean quality falls below this floor is never selected. */
  qualityFloor: number;
  /** Request cost (USD) at which the cost score is 0.5. */
  referenceCostUsd: number;
  /** Latency (ms) at which the latency score is 0.5. */
  referenceLatencyMs: number;
  /** Models whose estimated request cost exceeds this are not evaluated or selected. */
  maxRequestCostUsd: number;
  typicalPromptTokens: number;
  typicalCompletionTokens: number;
  minContextTokens: number;
  maxOutputTokens: number;
  /** Per-answer timeout during evaluation; long-form asks need more time to finish. */
  evaluationTimeoutMs: number;
  evaluationCases: AiEvaluationCase[];
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  /** Cost reported by OpenRouter for the request, when present. */
  costUsd?: number;
}

export interface AiCompletionResult {
  text: string;
  model: string;
  usage: AiUsage;
  latencyMs: number;
}

/** One model answering one evaluation case, graded. */
export interface AiModelEvaluationRecord {
  runId: string;
  taskKind: AiTaskKind;
  caseId: string;
  modelId: string;
  status: "graded" | "failed";
  qualityScore: number;
  judgeScore: number;
  deterministicScore: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  graderModelId: string;
  graderRationale: string;
  /** Truncated answer to a synthetic prompt, kept for human spot-checks. */
  outputExcerpt: string;
  evaluatedAt: string;
}

export interface AiModelAggregate {
  modelId: string;
  sampleCount: number;
  meanQuality: number;
  medianLatencyMs: number;
  lastEvaluatedAt: string;
}

export interface AiRankedModel {
  modelId: string;
  fitScore: number;
  meanQuality: number;
  qualityScore: number;
  costScore: number;
  latencyScore: number;
  estimatedRequestCostUsd: number;
  medianLatencyMs: number;
  sampleCount: number;
}

export interface AiModelSelection {
  taskKind: AiTaskKind;
  modelId: string;
  fallbackModelIds: string[];
  fitScore: number | null;
  reason: string;
  runId: string | null;
  selectedAt: string;
}

export interface AiGatewayUsageRecord {
  taskKind: AiTaskKind;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number | null;
  latencyMs: number;
  status: "completed" | "failed";
  createdAt: string;
}

export interface AiEvaluationRunSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  status: "completed" | "budget_exhausted" | "deadline_reached" | "failed";
  spentUsd: number;
  evaluatedModelCount: number;
  selectionChanges: Array<{ taskKind: AiTaskKind; from: string | null; to: string }>;
}

export interface AiGatewayRepository {
  listCurrentSelections(): Promise<AiModelSelection[]>;
  recordSelection(selection: AiModelSelection): Promise<void>;
  listEvaluationsSince(taskKind: AiTaskKind, since: string): Promise<AiModelEvaluationRecord[]>;
  recordEvaluations(records: AiModelEvaluationRecord[]): Promise<void>;
  recordRun(summary: AiEvaluationRunSummary): Promise<void>;
  listRecentRuns(limit: number): Promise<AiEvaluationRunSummary[]>;
  recordUsage(record: AiGatewayUsageRecord): Promise<void>;
  summarizeUsageSince(since: string): Promise<Array<{
    taskKind: AiTaskKind;
    modelId: string;
    requestCount: number;
    costUsd: number;
  }>>;
}

export class AiGatewayUnavailableError extends Error {
  constructor(message = "AI is unavailable in this environment.") {
    super(message);
    this.name = "AiGatewayUnavailableError";
  }
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export function isAiTaskKind(value: unknown): value is AiTaskKind {
  return typeof value === "string" && (aiTaskKinds as readonly string[]).includes(value);
}
