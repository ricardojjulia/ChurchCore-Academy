import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { SignalAggregator } from "@/modules/shepherd-ai/signal-aggregator";

test("signal normalization creates expected Academy-only signals", () => {
  const signals = new SignalAggregator().evaluate(academyDataset);

  assert.ok(signals.some((signal) => signal.signalType === "enrollment_pending_beyond_threshold" && signal.entityId === "stu-maya-bennett"));
  assert.ok(signals.some((signal) => signal.signalType === "required_document_missing" && signal.entityId === "stu-ezra-coleman"));
  assert.ok(signals.some((signal) => signal.signalType === "graduation_threshold_near" && signal.entityId === "stu-naomi-price"));
  assert.ok(signals.some((signal) => signal.signalType === "credit_progress_gap" && signal.entityId === "stu-daniel-hart"));
  assert.ok(signals.some((signal) => signal.signalType === "transcript_inconsistency_possible" && signal.entityId === "stu-leah-brooks"));
  assert.ok(signals.some((signal) => signal.signalType === "faculty_course_assignment_imbalance" && signal.entityId === "fac-miriam-stone"));
});
