import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { WorkflowQueueItem, WorkflowFeedbackInput } from "../types";

describe("academic-workflows types", () => {
  it("WorkflowQueueItem has the expected shape", () => {
    const item: WorkflowQueueItem = {
      kind: "suggestion",
      id: "test-id",
      workflowCode: "missing_documentation_review",
      title: "Test",
      summary: "Test summary",
      entityType: "student",
      entityId: "student-1",
      urgency: "medium",
      status: "suggested",
      generatedAt: new Date().toISOString(),
    };
    assert.equal(item.kind, "suggestion");
    assert.equal(item.urgency, "medium");
  });

  it("WorkflowFeedbackInput has the expected shape", () => {
    const input: WorkflowFeedbackInput = {
      workflowId: "wf-1",
      userId: "user-1",
      feedbackType: "accepted",
    };
    assert.equal(input.workflowId, "wf-1");
    assert.equal(input.feedbackType, "accepted");
  });
});
