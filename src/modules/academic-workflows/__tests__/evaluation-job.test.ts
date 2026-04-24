import assert from "node:assert/strict";
import test from "node:test";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";

test("scheduled evaluation creates suggestions and promotes selected workflows", async () => {
  const result = await runAcademicWorkflowEvaluationJob();

  assert.ok(result.signals.length >= 6);
  assert.ok(result.suggestions.length >= 6);
  assert.ok(result.repository.workflows.length >= 3);
  assert.ok(result.repository.workflowActions.some((action) => action.actionType === "promote"));
});

test("workflow queue retrieval returns both suggestions and promoted workflows", async () => {
  const result = await runAcademicWorkflowEvaluationJob();
  const queue = result.workflows.getWorkflowQueue();

  assert.ok(queue.some((item) => item.kind === "suggestion"));
  assert.ok(queue.some((item) => item.kind === "workflow"));
});

test("workflow service records completion and feedback", async () => {
  const result = await runAcademicWorkflowEvaluationJob();
  const workflow = result.repository.workflows.find((item) => item.workflowCode === "transcript_or_records_inconsistency_review");

  assert.ok(workflow);
  assert.equal(workflow.status, "completed");
  assert.ok(result.repository.workflowFeedback.some((feedback) => feedback.workflowId === workflow.id && feedback.feedbackType === "accepted"));
});
