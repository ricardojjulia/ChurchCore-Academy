import { AiModelCandidate, AiTaskProfile } from "@/modules/ai-gateway/types";

/** Providers the evaluator considers by default. Override with AI_EVAL_PROVIDER_PREFIXES. */
export const DEFAULT_PROVIDER_PREFIXES = [
  "anthropic/",
  "openai/",
  "google/",
  "deepseek/",
  "qwen/",
  "mistralai/",
  "meta-llama/",
  "x-ai/",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : NaN;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

/**
 * Normalizes OpenRouter's /models payload into priced, text-capable candidates. Drops router
 * pseudo-models (negative prices), variant suffixes (`:free`, `:batch`), and anything that cannot
 * read and write plain text.
 */
export function normalizeOpenRouterCatalog(raw: unknown[]): AiModelCandidate[] {
  const candidates: AiModelCandidate[] = [];

  for (const entry of raw) {
    const model = asRecord(entry);
    if (!model || typeof model.id !== "string" || model.id.includes(":")) continue;

    const pricing = asRecord(model.pricing);
    const prompt = toNumber(pricing?.prompt);
    const completion = toNumber(pricing?.completion);
    if (!(prompt > 0) || !(completion > 0)) continue;

    const architecture = asRecord(model.architecture);
    const inputs = Array.isArray(architecture?.input_modalities) ? architecture.input_modalities : [];
    const outputs = Array.isArray(architecture?.output_modalities) ? architecture.output_modalities : [];
    if (!inputs.includes("text") || outputs.length !== 1 || outputs[0] !== "text") continue;

    const contextLength = toNumber(model.context_length);
    if (!(contextLength > 0)) continue;

    const topProvider = asRecord(model.top_provider);
    const maxCompletion = toNumber(topProvider?.max_completion_tokens);
    const created = toNumber(model.created);
    const expiration = typeof model.expiration_date === "string" ? model.expiration_date : undefined;

    candidates.push({
      id: model.id,
      name: typeof model.name === "string" ? model.name : model.id,
      contextLength,
      maxCompletionTokens: maxCompletion > 0 ? maxCompletion : undefined,
      promptUsdPerMillion: prompt * 1_000_000,
      completionUsdPerMillion: completion * 1_000_000,
      createdAt: new Date((created > 0 ? created : 0) * 1000).toISOString(),
      expiresAt: expiration,
    });
  }

  return candidates;
}

export function estimateRequestCostUsd(candidate: AiModelCandidate, profile: AiTaskProfile) {
  return (
    (candidate.promptUsdPerMillion * profile.typicalPromptTokens +
      candidate.completionUsdPerMillion * profile.typicalCompletionTokens) /
    1_000_000
  );
}

export interface CandidateFilterOptions {
  now: Date;
  providerPrefixes: string[];
  /** Ignore models released longer ago than this. */
  maxAgeDays: number;
}

/** Models that are eligible to serve (and therefore to be evaluated for) a task profile. */
export function eligibleCandidates(
  catalog: AiModelCandidate[],
  profile: AiTaskProfile,
  options: CandidateFilterOptions,
): AiModelCandidate[] {
  const now = options.now.getTime();
  const oldest = now - options.maxAgeDays * DAY_MS;
  const expiryCutoff = now + 30 * DAY_MS;

  return catalog.filter((candidate) => {
    if (!options.providerPrefixes.some((prefix) => candidate.id.startsWith(prefix))) return false;
    if (candidate.contextLength < profile.minContextTokens) return false;
    // The gateway requests up to the profile's output ceiling, so a model must be able to honor it.
    if (candidate.maxCompletionTokens !== undefined && candidate.maxCompletionTokens < profile.maxOutputTokens) return false;
    if (Date.parse(candidate.createdAt) < oldest) return false;
    if (candidate.expiresAt && Date.parse(candidate.expiresAt) < expiryCutoff) return false;
    return estimateRequestCostUsd(candidate, profile) <= profile.maxRequestCostUsd;
  });
}
