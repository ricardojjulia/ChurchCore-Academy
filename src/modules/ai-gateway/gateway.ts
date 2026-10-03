import { readOpenRouterUsage } from "@/modules/ai-gateway/openrouter-client";
import type { OpenRouterClient } from "@/modules/ai-gateway/openrouter-client";
import { COLD_START_MODEL } from "@/modules/ai-gateway/scoring";
import { AI_TASK_PROFILES } from "@/modules/ai-gateway/task-profiles";
import {
  AiChatMessage,
  AiCompletionResult,
  AiGatewayRepository,
  AiGatewayUsageRecord,
  AiModelSelection,
  AiRequestTooLargeError,
  AiTaskKind,
} from "@/modules/ai-gateway/types";

const SELECTION_CACHE_MS = 5 * 60 * 1000;
/**
 * Admission estimate, not a spend bound: ~3 UTF-8 bytes per token. Counting bytes rather than
 * characters keeps CJK (3 bytes/char) and emoji (4) from slipping past a character count. A strict
 * one-token-per-byte bound would reject ordinary long English conversations, roughly 4x too early.
 */
const BYTES_PER_TOKEN_ESTIMATE = 3;
const MESSAGE_OVERHEAD_TOKENS = 16;
const utf8 = new TextEncoder();

/**
 * Rejects a request whose estimated prompt plus the ask's output ceiling would overflow the
 * smallest context window any model eligible for the ask is guaranteed to have, so it fails
 * fast with a clear message instead of upstream after routing. It is an estimate: a borderline
 * request that passes and still overflows surfaces as the provider's error.
 */
export function assertFitsContext(taskKind: AiTaskKind, messages: AiChatMessage[]) {
  const profile = AI_TASK_PROFILES[taskKind];
  const promptTokens = messages.reduce(
    (total, message) => total + Math.ceil(utf8.encode(message.content).length / BYTES_PER_TOKEN_ESTIMATE) + MESSAGE_OVERHEAD_TOKENS,
    0,
  );
  if (promptTokens + profile.maxOutputTokens > profile.minContextTokens) {
    throw new AiRequestTooLargeError();
  }
}

export interface AiRoute {
  model: string;
  fallbackModels: string[];
}

export interface AiGatewayRequest {
  taskKind: AiTaskKind;
  messages: AiChatMessage[];
  /** Capped at the task profile's maxOutputTokens. */
  maxTokens?: number;
}

export interface AiGatewayDependencies {
  client: Pick<OpenRouterClient, "complete" | "stream">;
  repository: Pick<AiGatewayRepository, "listCurrentSelections" | "recordUsage">;
  now?: () => Date;
  /** Usage writes must never fail a user request; this receives the error instead. */
  /**
   * Receives the usage record (counts and cost only, never content) when it could not be persisted
   * after retries, so the route layer can emit it to logs for reconciliation.
   */
  onUsageError?: (error: unknown, record: AiGatewayUsageRecord) => void;
  /** Delay before each retry of a failed usage write; defaults to USAGE_RETRY_DELAYS_MS. */
  usageRetryDelaysMs?: number[];
  randomId?: () => string;
}

/** Bounded so a database outage adds at most ~0.6s to a request. */
export const USAGE_RETRY_DELAYS_MS = [100, 500];

let selectionCache: { loadedAt: number; selections: Map<AiTaskKind, AiModelSelection> } | undefined;

export function clearAiRouteCache() {
  selectionCache = undefined;
}

/**
 * The single entry point for every model call in Academy. Routes each ask to the model the
 * evaluator currently ranks best for it (with OpenRouter-side fallbacks) and meters usage.
 */
export class AiGateway {
  private readonly now: () => Date;

  constructor(private readonly dependencies: AiGatewayDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async resolveRoute(taskKind: AiTaskKind): Promise<AiRoute> {
    const nowMs = this.now().getTime();
    if (!selectionCache || nowMs - selectionCache.loadedAt > SELECTION_CACHE_MS) {
      try {
        const selections = await this.dependencies.repository.listCurrentSelections();
        selectionCache = {
          loadedAt: nowMs,
          selections: new Map(selections.map((selection) => [selection.taskKind, selection])),
        };
      } catch {
        // Selections are an optimization; an unreadable table must not take AI offline.
        return { model: COLD_START_MODEL, fallbackModels: [] };
      }
    }

    const selection = selectionCache.selections.get(taskKind);
    return selection
      ? { model: selection.modelId, fallbackModels: selection.fallbackModelIds }
      : { model: COLD_START_MODEL, fallbackModels: [] };
  }

  private clampTokens(request: AiGatewayRequest) {
    const ceiling = AI_TASK_PROFILES[request.taskKind].maxOutputTokens;
    return Math.max(1, Math.min(request.maxTokens ?? ceiling, ceiling));
  }

  /**
   * Usage writes must never fail a user request, so a write that still fails after bounded retries
   * hands the record to onUsageError instead of being dropped silently. Retries are idempotent.
   */
  private async recordUsage(fields: Omit<AiGatewayUsageRecord, "id">) {
    // The id is fixed before the first attempt: a write that committed but lost its
    // acknowledgement is retried with the same id and ignored as a duplicate.
    const record: AiGatewayUsageRecord = { id: (this.dependencies.randomId ?? (() => crypto.randomUUID()))(), ...fields };
    const delays = this.dependencies.usageRetryDelaysMs ?? USAGE_RETRY_DELAYS_MS;
    for (let attempt = 0; ; attempt += 1) {
      try {
        await this.dependencies.repository.recordUsage(record);
        return;
      } catch (error) {
        if (attempt >= delays.length) {
          this.dependencies.onUsageError?.(error, record);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }
  }

  /** The ask's long-form answer budget doubles as its request timeout. */
  private timeoutMs(taskKind: AiTaskKind) {
    return AI_TASK_PROFILES[taskKind].evaluationTimeoutMs;
  }

  async complete(request: AiGatewayRequest): Promise<AiCompletionResult> {
    assertFitsContext(request.taskKind, request.messages);
    const route = await this.resolveRoute(request.taskKind);
    const started = this.now().getTime();
    try {
      const result = await this.dependencies.client.complete({
        model: route.model,
        fallbackModels: route.fallbackModels,
        messages: request.messages,
        maxTokens: this.clampTokens(request),
        timeoutMs: this.timeoutMs(request.taskKind),
      });
      await this.recordUsage({
        taskKind: request.taskKind,
        modelId: result.model,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        costUsd: result.usage.costUsd ?? null,
        latencyMs: result.latencyMs,
        status: "completed",
        createdAt: this.now().toISOString(),
      });
      return result;
    } catch (error) {
      await this.recordUsage(this.failedUsage(request.taskKind, route.model, started));
      throw error;
    }
  }

  private failedUsage(taskKind: AiTaskKind, model: string, started: number): Omit<AiGatewayUsageRecord, "id"> {
    return {
      taskKind,
      modelId: model,
      promptTokens: 0,
      completionTokens: 0,
      costUsd: null,
      latencyMs: this.now().getTime() - started,
      status: "failed",
      createdAt: this.now().toISOString(),
    };
  }

  /**
   * Streams OpenAI-format SSE chunks through unchanged and records usage exactly once: from the
   * final chunk on a clean finish (OpenRouter sends `usage` there when `usage.include` is set), or
   * as a failed call when the client disconnects or the upstream stream errors.
   *
   * `requestedModel` is the route asked for (it may be the auto-router or a primary that fell
   * back). The model that actually answered is in each chunk's `model` field.
   */
  async stream(request: AiGatewayRequest): Promise<{ body: ReadableStream<Uint8Array>; requestedModel: string }> {
    assertFitsContext(request.taskKind, request.messages);
    const route = await this.resolveRoute(request.taskKind);
    const started = this.now().getTime();

    let upstream: Response;
    try {
      upstream = await this.dependencies.client.stream({
        model: route.model,
        fallbackModels: route.fallbackModels,
        messages: request.messages,
        maxTokens: this.clampTokens(request),
        timeoutMs: this.timeoutMs(request.taskKind),
      });
    } catch (error) {
      await this.recordUsage(this.failedUsage(request.taskKind, route.model, started));
      throw error;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let servedModel = route.model;
    let usage: ReturnType<typeof readOpenRouterUsage>;
    let recorded = false;

    const scanLine = (line: string) => {
      if (!line.startsWith("data:")) return;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") return;
      try {
        const chunk = JSON.parse(raw) as { model?: unknown; usage?: unknown };
        if (typeof chunk.model === "string") servedModel = chunk.model;
        usage = readOpenRouterUsage(chunk.usage) ?? usage;
      } catch {
        // OpenRouter interleaves keep-alive comments; anything unparseable is ignored.
      }
    };

    const finish = async (interrupted: boolean) => {
      if (recorded) return;
      recorded = true;
      await this.recordUsage({
        taskKind: request.taskKind,
        modelId: servedModel,
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
        costUsd: usage?.costUsd ?? null,
        latencyMs: this.now().getTime() - started,
        status: usage && !interrupted ? "completed" : "failed",
        createdAt: this.now().toISOString(),
      });
    };

    const reader = upstream.body!.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        let next: ReadableStreamReadResult<Uint8Array>;
        try {
          next = await reader.read();
        } catch (error) {
          await finish(true);
          controller.error(error);
          return;
        }
        if (next.done) {
          scanLine(buffer);
          await finish(false);
          controller.close();
          return;
        }
        controller.enqueue(next.value);
        buffer += decoder.decode(next.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(scanLine);
      },
      async cancel(reason) {
        // The client went away mid-answer. Stop the provider first (it bills until cancelled), and
        // meter what we know concurrently so a slow usage write can't keep generation running.
        const stopping = reader.cancel(reason).catch(() => undefined);
        await Promise.all([stopping, finish(true)]);
      },
    });

    return { body, requestedModel: route.model };
  }
}
