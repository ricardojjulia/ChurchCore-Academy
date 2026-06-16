import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "@/app/api/ai/route";

test("returns a neutral unavailable response when the Anthropic key is missing", async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  try {
    const response = await POST(
      new Request("http://localhost/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", messages: [] }),
      }) as never,
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "AI council is unavailable in this environment.",
    });
  } finally {
    if (previous === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = previous;
    }
  }
});

test("surfaces Anthropic upstream error messages", async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = "test-key";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          message: "invalid x-api-key",
        },
      }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    const response = await POST(
      new Request("http://localhost/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", messages: [] }),
      }) as never,
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "invalid x-api-key" });
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = previous;
    }
  }
});
