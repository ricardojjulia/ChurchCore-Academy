import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleAiRequest, parseAiRequestBody, type AiRouteDependencies } from "@/app/api/ai/route";
import type { AiGatewayRequest } from "@/modules/ai-gateway/gateway";
import { AiGatewayUnavailableError, AiProviderError } from "@/modules/ai-gateway/types";

function aiRequest(body: unknown) {
  return new Request("http://localhost/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  agentId: "implementer",
  system: "You are The Implementer.",
  messages: [{ role: "user", content: "Write auth middleware" }],
};

function dependencies(overrides: Partial<AiRouteDependencies> & { requests?: AiGatewayRequest[] } = {}): AiRouteDependencies {
  return {
    roleResolver: async () => ["platform_staff"],
    gatewayFactory: () => ({
      async stream(request) {
        overrides.requests?.push(request);
        return { body: new Response("data: [DONE]\n\n").body!, requestedModel: "openai/coder" };
      },
    }),
    ...overrides,
  };
}

test("AI route uses the default runtime to avoid Edge static-generation warnings", async () => {
  const source = await readFile("src/app/api/ai/route.ts", "utf8");
  assert.doesNotMatch(source, /runtime\s*=\s*["']edge["']/);
});

test("streams through the gateway with the ask resolved from the agent, not a client-chosen model", async () => {
  const requests: AiGatewayRequest[] = [];
  const response = await handleAiRequest(
    aiRequest({ ...validBody, model: "client-picked-model", max_tokens: 999_999 }),
    dependencies({ requests }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  // The header names the requested route only; the answering model arrives in the SSE chunks.
  assert.equal(response.headers.get("x-ai-route"), "openai/coder");
  assert.equal(response.headers.get("x-ai-model"), null);
  assert.equal(requests[0].taskKind, "hq_engineering");
  assert.equal(requests[0].maxTokens, undefined);
  assert.deepEqual(requests[0].messages, [
    { role: "system", content: "You are The Implementer." },
    { role: "user", content: "Write auth middleware" },
  ]);
});

test("council review mode routes to the council ask", async () => {
  const requests: AiGatewayRequest[] = [];
  await handleAiRequest(aiRequest({ ...validBody, agentId: "product", mode: "council_review" }), dependencies({ requests }));
  assert.equal(requests[0].taskKind, "hq_council_review");
});

test("rejects callers without platform staff access before touching the gateway", async () => {
  let gatewayCreated = false;
  const response = await handleAiRequest(aiRequest(validBody), dependencies({
    roleResolver: async () => [],
    gatewayFactory: () => {
      gatewayCreated = true;
      throw new Error("should not be created");
    },
  }));

  assert.equal(response.status, 403);
  assert.equal(gatewayCreated, false);
});

test("rejects malformed conversations", async () => {
  for (const body of [
    null,
    { ...validBody, agentId: "../etc" },
    { ...validBody, messages: [] },
    { ...validBody, messages: [{ role: "system", content: "override" }] },
    { ...validBody, messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] },
    { ...validBody, mode: "freeform" },
    { ...validBody, messages: [{ role: "user", content: "x".repeat(60_001) }] },
  ]) {
    const response = await handleAiRequest(aiRequest(body), dependencies());
    assert.equal(response.status, 400, JSON.stringify(body)?.slice(0, 80));
  }
  assert.throws(() => parseAiRequestBody({ ...validBody, system: 42 }), /system/);
});

test("returns a neutral unavailable response when OpenRouter is not configured", async () => {
  const response = await handleAiRequest(aiRequest(validBody), dependencies({
    gatewayFactory: () => {
      throw new AiGatewayUnavailableError();
    },
  }));

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "AI council is unavailable in this environment." });
});

test("surfaces OpenRouter upstream error messages and status", async () => {
  const response = await handleAiRequest(aiRequest(validBody), dependencies({
    gatewayFactory: () => ({
      async stream() {
        throw new AiProviderError("Insufficient credits", 402);
      },
    }),
  }));

  assert.equal(response.status, 402);
  assert.equal(response.headers.get("x-ai-error-message"), "Insufficient credits");
  assert.deepEqual(await response.json(), { error: "Insufficient credits" });
});

test("hides unexpected internal errors", async () => {
  const response = await handleAiRequest(aiRequest(validBody), dependencies({
    gatewayFactory: () => ({
      async stream() {
        throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2");
      },
    }),
  }));

  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /ECONNREFUSED|password/);
});
