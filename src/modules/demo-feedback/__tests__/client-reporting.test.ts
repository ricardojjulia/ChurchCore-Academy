import assert from "node:assert/strict";
import test from "node:test";
import { reportCapturedDemoError } from "@/modules/demo-feedback/client-reporting";

const session = {
  sessionId: "3bf4ca1f-66b0-458f-89a4-bfd74c965cbf",
  breadcrumbs: ["/", "/students"],
  route: "/students",
  demoVersion: "dev",
  sessionDurationSeconds: 10,
};

test("automatic error reporting swallows secondary transport failures", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };

  await assert.doesNotReject(async () => {
    await reportCapturedDemoError(session, "Unhandled render failure");
  });

  globalThis.fetch = previousFetch;
});

test("automatic error reporting sends route, breadcrumbs, version, and session duration", async () => {
  const previousFetch = globalThis.fetch;
  let capturedBody: unknown;

  globalThis.fetch = async (_url, init) => {
    capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response;
  };

  await reportCapturedDemoError(session, "Unhandled render failure");

  assert.deepEqual(capturedBody, {
    sessionId: "3bf4ca1f-66b0-458f-89a4-bfd74c965cbf",
    route: "/students",
    category: "ERROR",
    errorMessage: "Unhandled render failure",
    breadcrumbs: ["/", "/students"],
    demoVersion: "dev",
    sessionDurationSeconds: 10,
  });

  globalThis.fetch = previousFetch;
});
