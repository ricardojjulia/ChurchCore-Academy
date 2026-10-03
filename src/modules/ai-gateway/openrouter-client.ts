import {
  AiChatMessage,
  AiCompletionResult,
  AiProviderError,
  AiUsage,
} from "@/modules/ai-gateway/types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface OpenRouterClientOptions {
  /** Resolved at the route layer; never read from process.env in this module. */
  apiKey: string;
  fetch?: typeof fetch;
  appUrl?: string;
  appTitle?: string;
}

export interface OpenRouterCompletionRequest {
  model: string;
  /** OpenRouter tries these in order when the primary model is unavailable. */
  fallbackModels?: string[];
  messages: AiChatMessage[];
  maxTokens: number;
  temperature?: number;
  /** Ask the model for a JSON object (used by the evaluation grader). */
  jsonResponse?: boolean;
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
}

export interface OpenRouterCatalogResponse {
  data: unknown[];
}

function readUpstreamError(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const error = (data as { error?: unknown }).error;
    if (typeof error === "string" && error) return error;
    if (error && typeof error === "object") {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message) return message;
    }
  }
  return fallback;
}

export function readOpenRouterUsage(value: unknown): AiUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as { prompt_tokens?: unknown; completion_tokens?: unknown; cost?: unknown };
  if (typeof usage.prompt_tokens !== "number" || typeof usage.completion_tokens !== "number") {
    return undefined;
  }
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    costUsd: typeof usage.cost === "number" ? usage.cost : undefined,
  };
}

export class OpenRouterClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenRouterClientOptions) {
    if (!options.apiKey) {
      throw new Error("OpenRouter API key is required.");
    }
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  private headers() {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.options.apiKey}`,
      "content-type": "application/json",
      "x-title": this.options.appTitle ?? "ChurchCore Academy",
    };
    if (this.options.appUrl) {
      headers["http-referer"] = this.options.appUrl;
    }
    return headers;
  }

  /**
   * Request body shared by streaming and non-streaming calls. `data_collection: "deny"` keeps
   * OpenRouter from routing to any provider that retains or trains on prompts.
   */
  buildRequestBody(request: OpenRouterCompletionRequest, stream: boolean) {
    const fallbacks = (request.fallbackModels ?? []).filter((model) => model !== request.model);
    return {
      model: request.model,
      ...(fallbacks.length > 0 ? { models: [request.model, ...fallbacks] } : {}),
      messages: request.messages,
      max_tokens: request.maxTokens,
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.jsonResponse ? { response_format: { type: "json_object" } } : {}),
      stream,
      usage: { include: true },
      provider: { data_collection: "deny" },
    };
  }

  async listModels(): Promise<unknown[]> {
    const response = await this.fetchImpl(`${OPENROUTER_BASE_URL}/models`, {
      headers: this.headers(),
    });
    const data = (await response.json().catch(() => null)) as OpenRouterCatalogResponse | null;
    if (!response.ok || !data || !Array.isArray(data.data)) {
      throw new AiProviderError(readUpstreamError(data, "Unable to load the OpenRouter model catalog."), response.status);
    }
    return data.data;
  }

  async complete(request: OpenRouterCompletionRequest): Promise<AiCompletionResult> {
    const started = Date.now();
    const response = await this.fetchImpl(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.buildRequestBody(request, false)),
      signal: request.timeoutMs ? AbortSignal.timeout(request.timeoutMs) : undefined,
    });
    const data = (await response.json().catch(() => null)) as {
      model?: unknown;
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: unknown;
      error?: unknown;
    } | null;

    if (!response.ok || !data || data.error) {
      throw new AiProviderError(readUpstreamError(data, "AI request failed."), response.ok ? 502 : response.status);
    }

    const content = data.choices?.[0]?.message?.content;
    return {
      text: typeof content === "string" ? content : "",
      model: typeof data.model === "string" ? data.model : request.model,
      usage: readOpenRouterUsage(data.usage) ?? { promptTokens: 0, completionTokens: 0 },
      latencyMs: Date.now() - started,
    };
  }

  /** Returns the upstream SSE response (OpenAI chat-completions chunk format). */
  async stream(request: OpenRouterCompletionRequest): Promise<Response> {
    const response = await this.fetchImpl(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.buildRequestBody(request, true)),
    });

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => null);
      throw new AiProviderError(readUpstreamError(data, "AI request failed."), response.ok ? 502 : response.status);
    }

    return response;
  }
}
