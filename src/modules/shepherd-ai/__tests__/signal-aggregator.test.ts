import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { SignalAggregator } from "@/modules/shepherd-ai/signal-aggregator";

test("signal normalization creates expected Academy-only signals", () => {
  const signals = new SignalAggregator().evaluate(academyDataset);

  assert.ok(signals.some((signal) => signal.signalType === "incomplete_enrollment" && signal.entityId === "stu-maya-bennett"));
  assert.ok(signals.some((signal) => signal.signalType === "missing_student_documentation" && signal.entityId === "stu-ezra-coleman"));
  assert.ok(signals.some((signal) => signal.signalType === "graduation_eligibility" && signal.entityId === "stu-naomi-price"));
  assert.ok(signals.some((signal) => signal.signalType === "academic_progress_gap" && signal.entityId === "stu-daniel-hart"));
  assert.ok(signals.some((signal) => signal.signalType === "transcript_records_inconsistency" && signal.entityId === "stu-leah-brooks"));
  assert.ok(signals.some((signal) => signal.signalType === "faculty_course_assignment_imbalance" && signal.entityId === "fac-miriam-stone"));
});
