import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { AiGateway, assertFitsContext, clearAiRouteCache } from "@/modules/ai-gateway/gateway";
import { OpenRouterClient, type OpenRouterCompletionRequest } from "@/modules/ai-gateway/openrouter-client";
import { COLD_START_MODEL } from "@/modules/ai-gateway/scoring";
import { AI_TASK_PROFILES } from "@/modules/ai-gateway/task-profiles";
import { AiProviderError, AiRequestTooLargeError } from "@/modules/ai-gateway/types";
import { InMemoryAiGatewayRepository, NOW } from "@/modules/ai-gateway/__tests__/fixtures";

function sseResponse(lines: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  }), { status: 200, headers: { "content-type": "text/event-stream" } });
}

async function readAll(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

test("the client sends OpenRouter requests with fallbacks, usage accounting, and no-retention routing", async () => {
  let captured: { url: string; init: RequestInit } | undefined;
  const client = new OpenRouterClient({
    apiKey: "test-openrouter-key",
    appUrl: "https://academy.example",
    fetch: async (url, init) => {
      captured = { url: String(url), init: init ?? {} };
      return Response.json({
        model: "openai/served",
        choices: [{ message: { content: "Hello" } }],
        usage: { prompt_tokens: 12, completion_tokens: 3, cost: 0.0004 },
      });
    },
  });

  const result = await client.complete({
    model: "openai/primary",
    fallbackModels: ["openai/primary", "anthropic/backup"],
    messages: [{ role: "user", content: "Hi" }],
    maxTokens: 100,
  });

  assert.equal(captured?.url, "https://openrouter.ai/api/v1/chat/completions");
  const headers = captured?.init.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer test-openrouter-key");
  assert.equal(headers["http-referer"], "https://academy.example");
  const body = JSON.parse(String(captured?.init.body));
  assert.deepEqual(body.models, ["openai/primary", "anthropic/backup"]);
  assert.deepEqual(body.provider, { data_collection: "deny" });
  assert.deepEqual(body.usage, { include: true });
  assert.equal(body.stream, false);
  assert.deepEqual(result.usage, { promptTokens: 12, completionTokens: 3, costUsd: 0.0004 });
  assert.equal(result.model, "openai/served");
});

test("the client surfaces upstream errors without echoing the key", async () => {
  const client = new OpenRouterClient({
    apiKey: "sk-or-secret-value",
    fetch: async () => Response.json({ error: { message: "Insufficient credits" } }, { status: 402 }),
  });

  await assert.rejects(
    client.complete({ model: "openai/x", messages: [{ role: "user", content: "Hi" }], maxTokens: 10 }),
    (error: unknown) => {
      assert.ok(error instanceof AiProviderError);
      assert.equal(error.status, 402);
      assert.equal(error.message, "Insufficient credits");
      assert.doesNotMatch(error.message, /sk-or-secret-value/);
      return true;
    },
  );
});

test("the client refuses to start without an API key", () => {
  assert.throws(() => new OpenRouterClient({ apiKey: "" }), /API key is required/);
});

test("the gateway routes each ask to its evaluated selection and clamps output tokens", async () => {
  clearAiRouteCache();
  const repository = new InMemoryAiGatewayRepository();
  repository.selections.push({
    taskKind: "hq_engineering",
    modelId: "openai/coder",
    fallbackModelIds: ["anthropic/backup"],
    fitScore: 0.8,
    reason: "best",
    runId: "run-1",
    selectedAt: NOW.toISOString(),
  });
  const requests: OpenRouterCompletionRequest[] = [];
  const gateway = new AiGateway({
    repository,
    now: () => NOW,
    client: {
      async complete(request) {
        requests.push(request);
        return { text: "ok", model: request.model, usage: { promptTokens: 10, completionTokens: 20, costUsd: 0.001 }, latencyMs: 50 };
      },
      async stream() {
        throw new Error("unused");
      },
    },
  });

  await gateway.complete({ taskKind: "hq_engineering", messages: [{ role: "user", content: "x" }], maxTokens: 1_000_000 });
  await gateway.complete({ taskKind: "hq_writing", messages: [{ role: "user", content: "x" }] });

  assert.equal(requests[0].model, "openai/coder");
  assert.deepEqual(requests[0].fallbackModels, ["anthropic/backup"]);
  assert.equal(requests[0].maxTokens, 6_000);
  assert.equal(requests[1].model, COLD_START_MODEL, "an ask with no selection cold-starts on the auto-router");
  assert.deepEqual(repository.usage.map((record) => [record.taskKind, record.status, record.costUsd]), [
    ["hq_engineering", "completed", 0.001],
    ["hq_writing", "completed", 0.001],
  ]);
});

test("the gateway still serves when selections cannot be read, and meters failures", async () => {
  clearAiRouteCache();
  const repository = new InMemoryAiGatewayRepository();
  repository.listCurrentSelections = async () => {
    throw new Error("db down");
  };
  const gateway = new AiGateway({
    repository,
    now: () => NOW,
    client: {
      async complete() {
        throw new AiProviderError("Rate limited", 429);
      },
      async stream() {
        throw new Error("unused");
      },
    },
  });

  assert.deepEqual(await gateway.resolveRoute("hq_reasoning"), { model: COLD_START_MODEL, fallbackModels: [] });
  await assert.rejects(gateway.complete({ taskKind: "hq_reasoning", messages: [{ role: "user", content: "x" }] }), AiProviderError);
  assert.equal(repository.usage[0].status, "failed");
});

test("streaming passes chunks through unchanged and records usage from the final chunk", async () => {
  clearAiRouteCache();
  const repository = new InMemoryAiGatewayRepository();
  const lines = [
    ": OPENROUTER PROCESSING\n\n",
    'data: {"model":"anthropic/served","choices":[{"delta":{"content":"Hel"}}]}\n\n',
    'data: {"model":"anthropic/served","choices":[{"delta":{"content":"lo"}}]}\n\ndata: {"choices":[],',
    '"usage":{"prompt_tokens":40,"completion_tokens":2,"cost":0.00021}}\n\n',
    "data: [DONE]\n\n",
  ];
  const gateway = new AiGateway({
    repository,
    now: () => NOW,
    client: {
      async complete() {
        throw new Error("unused");
      },
      async stream() {
        return sseResponse(lines);
      },
    },
  });

  const { body, requestedModel } = await gateway.stream({ taskKind: "hq_council_review", messages: [{ role: "user", content: "Review" }] });
  assert.equal(requestedModel, COLD_START_MODEL, "the route asked for; the chunks name the model that answered");
  assert.equal(await readAll(body), lines.join(""));
  assert.deepEqual(repository.usage.map((record) => ({ ...record, createdAt: undefined, latencyMs: undefined })), [{
    taskKind: "hq_council_review",
    modelId: "anthropic/served",
    promptTokens: 40,
    completionTokens: 2,
    costUsd: 0.00021,
    status: "completed",
    createdAt: undefined,
    latencyMs: undefined,
  }]);
});

function streamingGateway(repository: InMemoryAiGatewayRepository, upstream: () => ReadableStream<Uint8Array>) {
  return new AiGateway({
    repository,
    now: () => NOW,
    client: {
      async complete() {
        throw new Error("unused");
      },
      async stream() {
        return new Response(upstream(), { status: 200, headers: { "content-type": "text/event-stream" } });
      },
    },
  });
}

test("a client that disconnects mid-stream still produces exactly one failed usage record", async () => {
  clearAiRouteCache();
  const repository = new InMemoryAiGatewayRepository();
  const encoder = new TextEncoder();
  let upstreamCancelled = false;
  const gateway = streamingGateway(repository, () => new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"model":"anthropic/served","choices":[{"delta":{"content":"Hel"}}]}\n\n'));
      // Never closes: the answer is still being generated when the client leaves.
    },
    cancel() {
      upstreamCancelled = true;
    },
  }));

  const { body } = await gateway.stream({ taskKind: "hq_reasoning", messages: [{ role: "user", content: "x" }] });
  const reader = body.getReader();
  await reader.read();
  await reader.cancel("client went away");
  await reader.cancel("again").catch(() => undefined);

  assert.equal(upstreamCancelled, true, "the upstream request is cancelled too, so it stops spending");
  assert.equal(repository.usage.length, 1);
  assert.equal(repository.usage[0].status, "failed");
  assert.equal(repository.usage[0].modelId, "anthropic/served");
});

test("a disconnect cancels the upstream without waiting for a slow usage write", async () => {
  clearAiRouteCache();
  const repository = new InMemoryAiGatewayRepository();
  let releaseUsage: () => void = () => undefined;
  repository.recordUsage = (record) => new Promise<void>((resolve) => {
    releaseUsage = () => {
      repository.usage.push(record);
      resolve();
    };
  });
  const encoder = new TextEncoder();
  let upstreamCancelled = false;
  const gateway = streamingGateway(repository, () => new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"model":"anthropic/served","choices":[{"delta":{"content":"Hel"}}]}\n\n'));
    },
    cancel() {
      upstreamCancelled = true;
    },
  }));

  const { body } = await gateway.stream({ taskKind: "hq_reasoning", messages: [{ role: "user", content: "x" }] });
  const reader = body.getReader();
  await reader.read();
  const cancelled = reader.cancel("client went away");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(upstreamCancelled, true, "the provider is stopped while metering is still pending");
  assert.equal(repository.usage.length, 0);
  releaseUsage();
  await cancelled;
  assert.equal(repository.usage.length, 1);
  assert.equal(repository.usage[0].status, "failed");
});

test("an upstream stream error produces exactly one failed usage record and surfaces the error", async () => {
  clearAiRouteCache();
  const repository = new InMemoryAiGatewayRepository();
  const encoder = new TextEncoder();
  let pulls = 0;
  const gateway = streamingGateway(repository, () => new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls === 1) {
        controller.enqueue(encoder.encode('data: {"model":"openai/served","choices":[{"delta":{"content":"Hi"}}]}\n\n'));
        return;
      }
      controller.error(new Error("upstream reset"));
    },
  }));

  const { body } = await gateway.stream({ taskKind: "hq_reasoning", messages: [{ role: "user", content: "x" }] });
  await assert.rejects(readAll(body), /upstream reset/);

  assert.equal(repository.usage.length, 1);
  assert.equal(repository.usage[0].status, "failed");
  assert.equal(repository.usage[0].modelId, "openai/served");
});

test("a stream that ends without a usage chunk is metered once as failed", async () => {
  clearAiRouteCache();
  const repository = new InMemoryAiGatewayRepository();
  const gateway = streamingGateway(repository, () => sseResponse(['data: {"choices":[{"delta":{"content":"cut"}}]}\n\n']).body!);

  const { body } = await gateway.stream({ taskKind: "hq_reasoning", messages: [{ role: "user", content: "x" }] });
  await readAll(body);

  assert.equal(repository.usage.length, 1);
  assert.equal(repository.usage[0].status, "failed");
});

test("the client honors a base URL override (used only by the e2e OpenRouter stub)", async () => {
  const urls: string[] = [];
  const client = new OpenRouterClient({
    apiKey: "stub-key",
    baseUrl: "http://127.0.0.1:9999/api/v1/",
    fetch: (async (url: string | URL | Request) => {
      urls.push(String(url));
      return Response.json({ data: [] });
    }) as typeof fetch,
  });
  await client.listModels();
  assert.deepEqual(urls, ["http://127.0.0.1:9999/api/v1/models"]);
});

test("requests are admitted only if they fit the ask's guaranteed context with its output ceiling", () => {
  const writing = AI_TASK_PROFILES.hq_writing;
  const budgetTokens = writing.minContextTokens - writing.maxOutputTokens;
  // One message: ~3 chars/token plus 16 tokens of overhead.
  const fits = "x".repeat((budgetTokens - 16) * 3);
  assert.doesNotThrow(() => assertFitsContext("hq_writing", [{ role: "user", content: fits }]));
  assert.throws(() => assertFitsContext("hq_writing", [{ role: "user", content: `${fits}xxxx` }]), AiRequestTooLargeError);
  // Larger asks have room for it.
  assert.doesNotThrow(() => assertFitsContext("hq_council_review", [{ role: "user", content: `${fits}xxxx` }]));
});

test("the gateway bounds every provider call with the ask's timeout", async () => {
  clearAiRouteCache();
  const timeouts: Array<number | undefined> = [];
  const gateway = new AiGateway({
    repository: new InMemoryAiGatewayRepository(),
    now: () => NOW,
    client: {
      async complete(request) {
        timeouts.push(request.timeoutMs);
        return { text: "ok", model: request.model, usage: { promptTokens: 1, completionTokens: 1 }, latencyMs: 1 };
      },
      async stream(request) {
        timeouts.push(request.timeoutMs);
        return sseResponse(["data: [DONE]\n\n"]);
      },
    },
  });

  await gateway.complete({ taskKind: "hq_writing", messages: [{ role: "user", content: "x" }] });
  await gateway.stream({ taskKind: "hq_council_review", messages: [{ role: "user", content: "x" }] });
  assert.deepEqual(timeouts, [
    AI_TASK_PROFILES.hq_writing.evaluationTimeoutMs,
    AI_TASK_PROFILES.hq_council_review.evaluationTimeoutMs,
  ]);
});

test("the client applies the timeout to streaming requests too", async () => {
  let signal: AbortSignal | null | undefined;
  const client = new OpenRouterClient({
    apiKey: "stub-key",
    fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal;
      return sseResponse(["data: [DONE]\n\n"]);
    }) as typeof fetch,
  });
  await client.stream({ model: "openai/x", messages: [{ role: "user", content: "Hi" }], maxTokens: 10, timeoutMs: 5_000 });
  assert.ok(signal instanceof AbortSignal, "a stalled stream is aborted instead of hanging the function");
});

test("a failed usage write is retried, then handed off with its record instead of dropped", async () => {
  clearAiRouteCache();
  const ok = { text: "ok", model: "openai/served", usage: { promptTokens: 3, completionTokens: 4, costUsd: 0.01 }, latencyMs: 5 };
  const client = {
    async complete() {
      return ok;
    },
    async stream(): Promise<Response> {
      throw new Error("unused");
    },
  };

  // Transient outage: two failures, then the write lands.
  const flaky = new InMemoryAiGatewayRepository();
  let attempts = 0;
  const write = flaky.recordUsage.bind(flaky);
  flaky.recordUsage = async (record) => {
    attempts += 1;
    if (attempts <= 2) throw new Error("db unavailable");
    await write(record);
  };
  const handedOff: unknown[] = [];
  await new AiGateway({ repository: flaky, client, now: () => NOW, usageRetryDelaysMs: [0, 0], onUsageError: (_e, record) => handedOff.push(record) })
    .complete({ taskKind: "hq_reasoning", messages: [{ role: "user", content: "x" }] });
  assert.equal(attempts, 3);
  assert.equal(flaky.usage.length, 1);
  assert.equal(handedOff.length, 0);

  // Sustained outage: the request still succeeds and the record reaches onUsageError.
  clearAiRouteCache();
  const down = new InMemoryAiGatewayRepository();
  down.recordUsage = async () => {
    throw new Error("db unavailable");
  };
  const result = await new AiGateway({ repository: down, client, now: () => NOW, usageRetryDelaysMs: [0, 0], onUsageError: (_e, record) => handedOff.push(record) })
    .complete({ taskKind: "hq_reasoning", messages: [{ role: "user", content: "x" }] });
  assert.equal(result.text, "ok");
  assert.equal(handedOff.length, 1);
  assert.deepEqual(
    { ...(handedOff[0] as Record<string, unknown>), createdAt: undefined },
    { taskKind: "hq_reasoning", modelId: "openai/served", promptTokens: 3, completionTokens: 4, costUsd: 0.01, latencyMs: 5, status: "completed", createdAt: undefined },
  );
});

test("the catalog request is bounded so a stall can't consume the run deadline", async () => {
  let signal: AbortSignal | null | undefined;
  const client = new OpenRouterClient({
    apiKey: "stub-key",
    fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal;
      return Response.json({ data: [] });
    }) as typeof fetch,
  });
  await client.listModels();
  assert.ok(signal instanceof AbortSignal);
});

// "Everything uses OpenRouter": no code outside the gateway may call a model provider directly.
const DIRECT_PROVIDER_PATTERN =
  /api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.deepseek\.com|api\.x\.ai|openrouter\.ai\/api|@anthropic-ai\/sdk|from ["']openai["']/;

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  }));
  return files.flat();
}

test("only the AI gateway's OpenRouter client talks to a model provider", async () => {
  const allowed = path.join("src", "modules", "ai-gateway", "openrouter-client.ts");
  const offenders: string[] = [];
  for (const file of await sourceFiles("src")) {
    if (file === allowed) continue;
    if (DIRECT_PROVIDER_PATTERN.test(await readFile(file, "utf8"))) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});
