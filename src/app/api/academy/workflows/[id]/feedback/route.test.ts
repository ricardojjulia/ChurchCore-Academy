import assert from "node:assert/strict";
import test from "node:test";
import { recordWorkflowFeedbackRequest } from "./route";

test("feedback route rejects userId impersonation attempt", async () => {
  let wasCalled = false;

  const response = await recordWorkflowFeedbackRequest(
    new Request("http://localhost/api/academy/workflows/workflow-1/feedback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-academy-user-id": "actor-1",
        "x-academy-tenant-id": "tenant-1",
        "x-academy-roles": "academic_admin",
      },
      body: JSON.stringify({
        userId: "other-user",
        feedbackType: "accepted",
      }),
    }),
    {
      params: Promise.resolve({ id: "workflow-1" }),
    },
    {
      recordFeedback: async () => {
        wasCalled = true;
        throw new Error("unexpected");
      },
    },
    async () => ({
      actor: {
        userId: "actor-1",
        tenantId: "tenant-1",
        roles: ["academic_admin"],
      },
    }),
  );

  const payload = (await response.json()) as { error: string };
  assert.equal(response.status, 403);
  assert.match(payload.error, /Forbidden workflow feedback actor\./);
  assert.equal(wasCalled, false);
});

test("feedback route binds userId to authenticated actor", async () => {
  let capturedUserId = "";

  const response = await recordWorkflowFeedbackRequest(
    new Request("http://localhost/api/academy/workflows/workflow-1/feedback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-academy-user-id": "actor-1",
        "x-academy-tenant-id": "tenant-1",
        "x-academy-roles": "academic_admin",
      },
      body: JSON.stringify({
        feedbackType: "needs_tuning",
        notes: "Needs clearer deadlines",
      }),
    }),
    {
      params: Promise.resolve({ id: "workflow-1" }),
    },
    {
      recordFeedback: async (_tenantId, _workflowId, userId, feedbackType, notes) => {
        capturedUserId = userId;
        return {
          id: "feedback-1",
          workflowId: "workflow-1",
          userId,
          feedbackType,
          notes,
          createdAt: "2026-06-12T00:00:00.000Z",
        };
      },
    },
    async () => ({
      actor: {
        userId: "actor-1",
        tenantId: "tenant-1",
        roles: ["academic_admin"],
      },
    }),
  );

  const payload = (await response.json()) as {
    feedback: {
      id: string;
      userId: string;
      feedbackType: string;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(capturedUserId, "actor-1");
  assert.equal(payload.feedback.userId, "actor-1");
  assert.equal(payload.feedback.feedbackType, "needs_tuning");
});
