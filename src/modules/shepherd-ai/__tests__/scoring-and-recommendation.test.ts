import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { AcademicConcernScorer } from "@/modules/shepherd-ai/academic-concern-scorer";
import { ContextBuilder } from "@/modules/shepherd-ai/context-builder";
import { SignalAggregator } from "@/modules/shepherd-ai/signal-aggregator";
import { WorkflowRecommender } from "@/modules/shepherd-ai/workflow-recommender";

test("scoring remains deterministic and recommendation text stays guarded", () => {
  const signals = new SignalAggregator().evaluate(academyDataset);
  const target = signals.find((signal) => signal.signalType === "academic_progress_gap" && signal.entityId === "stu-daniel-hart");

  assert.ok(target);

  const score = new AcademicConcernScorer().score(target);
  const context = new ContextBuilder().build(academyDataset, target);
  const suggestion = new WorkflowRecommender().recommend(target, context, score);

  assert.equal(suggestion.workflowCode, "academic-progress-review");
  assert.equal(suggestion.urgency, "high");
  assert.match(suggestion.summary, /may benefit from advisor review/i);
  assert.match(suggestion.boundaryNote, /Do not infer motivation/i);
});
