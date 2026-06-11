import assert from "node:assert/strict";
import test from "node:test";
import { listDemoFeedbackRequest } from "@/app/api/academy/platform/demo-feedback/route";
import { patchDemoFeedbackRequest } from "@/app/api/academy/platform/demo-feedback/[id]/route";

const staffHeaders = {
  "x-platform-role": "platform_staff",
};

test("only platform staff can load triage records", async () => {
  const denied = await listDemoFeedbackRequest(
    new Request("http://localhost/api/academy/platform/demo-feedback", {
      headers: {},
    }),
    {
      list: async () => [],
    },
  );

  assert.equal(denied.status, 403);

  const allowed = await listDemoFeedbackRequest(
    new Request("http://localhost/api/academy/platform/demo-feedback?status=open", {
      headers: staffHeaders,
    }),
    {
      list: async () => [{ id: "a" }],
    },
  );

  assert.equal(allowed.status, 200);
});

test("only platform staff can mutate triage records", async () => {
  const denied = await patchDemoFeedbackRequest(
    new Request("http://localhost/api/academy/platform/demo-feedback/abc", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ processed: true }),
    }),
    { params: Promise.resolve({ id: "abc" }) },
    {
      update: async () => ({ id: "abc" }),
    },
  );

  assert.equal(denied.status, 403);

  const allowed = await patchDemoFeedbackRequest(
    new Request("http://localhost/api/academy/platform/demo-feedback/abc", {
      method: "PATCH",
      headers: { ...staffHeaders, "content-type": "application/json" },
      body: JSON.stringify({ processed: true }),
    }),
    { params: Promise.resolve({ id: "abc" }) },
    {
      update: async () => ({ id: "abc", processed: true }),
    },
  );

  assert.equal(allowed.status, 200);
});

test("mutation endpoint validates action allowlist", async () => {
  const response = await patchDemoFeedbackRequest(
    new Request("http://localhost/api/academy/platform/demo-feedback/abc", {
      method: "PATCH",
      headers: { ...staffHeaders, "content-type": "application/json" },
      body: JSON.stringify({ action: "not-valid" }),
    }),
    { params: Promise.resolve({ id: "abc" }) },
    {
      update: async () => ({ id: "abc" }),
    },
  );

  assert.equal(response.status, 400);
});
