import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { SignalAggregator } from "@/modules/shepherd-ai/signal-aggregator";
import { AcademyDataset } from "@/modules/academy-data/types";

test("signal normalization creates expected Academy-only signals", () => {
  const signals = new SignalAggregator().evaluate(academyDataset);

  assert.ok(signals.some((signal) => signal.signalType === "enrollment_pending_beyond_threshold" && signal.entityId === "stu-maya-bennett"));
  assert.ok(signals.some((signal) => signal.signalType === "required_document_missing" && signal.entityId === "stu-ezra-coleman"));
  assert.ok(signals.some((signal) => signal.signalType === "graduation_threshold_near" && signal.entityId === "stu-naomi-price"));
  assert.ok(signals.some((signal) => signal.signalType === "credit_progress_gap" && signal.entityId === "stu-daniel-hart"));
  assert.ok(signals.some((signal) => signal.signalType === "transcript_inconsistency_possible" && signal.entityId === "stu-leah-brooks"));
  assert.ok(signals.some((signal) => signal.signalType === "faculty_course_assignment_imbalance" && signal.entityId === "fac-miriam-stone"));
});

test("calendar gap detection does not emit signal when calendar is valid", () => {
  const signals = new SignalAggregator().evaluate(academyDataset);
  const calendarSignals = signals.filter((signal) => signal.signalType === "calendar_setup_incomplete_or_inconsistent");

  assert.equal(calendarSignals.length, 0);
});

test("calendar gap detection emits signal with validation errors", () => {
  const datasetWithGap: AcademyDataset = {
    ...academyDataset,
    academicCalendar: {
      ...academyDataset.academicCalendar,
      academicYears: [
        {
          id: "year-invalid",
          tenantId: "cca-main",
          name: "Invalid Year",
          code: "2026",
          startsOn: "2026-12-31",
          endsOn: "2026-01-01", // ends before starts - invalid
          status: "active",
          calendarSystem: "rolling_enrollment",
          createdAt: "2026-04-23T09:00:00.000Z",
          updatedAt: "2026-04-23T09:00:00.000Z",
        },
      ],
    },
  };

  const signals = new SignalAggregator().evaluate(datasetWithGap);
  const calendarSignal = signals.find((signal) => signal.signalType === "calendar_setup_incomplete_or_inconsistent");

  assert.ok(calendarSignal, "calendar gap signal should be present");
  assert.equal(calendarSignal?.entityType, "institution");
  assert.equal(calendarSignal?.entityId, "cca-main");
  assert.equal(calendarSignal?.tenantId, "cca-main");
  assert.ok(calendarSignal?.signalPayloadJson?.validationErrors, "signal should include validation errors");
  assert.ok(Array.isArray(calendarSignal?.signalPayloadJson?.validationErrors), "validation errors should be an array");
  assert.ok((calendarSignal?.signalPayloadJson?.validationErrors as string[]).length > 0, "validation errors should not be empty");
});

test("calendar gap signal respects tenant isolation", () => {
  const datasetWithGap: AcademyDataset = {
    ...academyDataset,
    tenantId: "cca-main",
    academicCalendar: {
      ...academyDataset.academicCalendar,
      academicYears: [
        {
          id: "year-invalid",
          tenantId: "cca-main",
          name: "Invalid Year",
          code: "2026",
          startsOn: "2026-12-31",
          endsOn: "2026-01-01",
          status: "active",
          calendarSystem: "rolling_enrollment",
          createdAt: "2026-04-23T09:00:00.000Z",
          updatedAt: "2026-04-23T09:00:00.000Z",
        },
      ],
    },
  };

  const signals = new SignalAggregator().evaluate(datasetWithGap);
  const calendarSignals = signals.filter((signal) => signal.signalType === "calendar_setup_incomplete_or_inconsistent");

  // All calendar signals should have tenantId matching the dataset
  for (const signal of calendarSignals) {
    assert.equal(signal.tenantId, datasetWithGap.tenantId, "signal tenantId must match dataset tenantId");
  }
});
