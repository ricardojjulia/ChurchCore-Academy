import assert from "node:assert/strict";
import test from "node:test";
import { submitDemoFeedbackRequest } from "@/app/api/academy/demo-feedback/route";

const originalDemoMode = process.env.DEMO_MODE_ENABLED;

const validPayload = {
  sessionId: "3bf4ca1f-66b0-458f-89a4-bfd74c965cbf",
  route: "/workflows",
  category: "BUG",
  breadcrumbs: ["/", "/workflows"],
  demoVersion: "dev",
  sessionDurationSeconds: 1,
};

test.after(() => {
  process.env.DEMO_MODE_ENABLED = originalDemoMode;
});

test("submission endpoint rejects when demo mode is disabled", async () => {
  process.env.DEMO_MODE_ENABLED = "false";

  const response = await submitDemoFeedbackRequest(
    new Request("http://localhost/api/academy/demo-feedback", {
      method: "POST",
      body: JSON.stringify(validPayload),
      headers: { "content-type": "application/json" },
    }),
    {
      submitFromJson: async () => ({ status: "accepted" }),
    },
  );

  assert.equal(response.status, 503);
});

test("submission endpoint returns 429 when rate limit rejects", async () => {
  process.env.DEMO_MODE_ENABLED = "true";

  const response = await submitDemoFeedbackRequest(
    new Request("http://localhost/api/academy/demo-feedback", {
      method: "POST",
      body: JSON.stringify(validPayload),
      headers: { "content-type": "application/json" },
    }),
    {
      submitFromJson: async () => ({ status: "rate_limited" }),
    },
  );

  assert.equal(response.status, 429);
});

test("submission endpoint returns generic 500 for server failures", async () => {
  process.env.DEMO_MODE_ENABLED = "true";

  const response = await submitDemoFeedbackRequest(
    new Request("http://localhost/api/academy/demo-feedback", {
      method: "POST",
      body: JSON.stringify(validPayload),
      headers: { "content-type": "application/json" },
    }),
    {
      submitFromJson: async () => {
        throw new Error("database exploded");
      },
    },
  );

  assert.equal(response.status, 500);

  const payload = (await response.json()) as { error: string };
  assert.equal(payload.error, "Unable to store feedback right now.");
});

test("malformed JSON request returns 400", async () => {
  process.env.DEMO_MODE_ENABLED = "true";

  const response = await submitDemoFeedbackRequest(
    new Request("http://localhost/api/academy/demo-feedback", {
      method: "POST",
      body: "{broken-json",
      headers: { "content-type": "application/json" },
    }),
    {
      submitFromJson: async () => ({ status: "accepted" }),
    },
  );

  assert.equal(response.status, 400);
});
