import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { buildAcademicCalendarReviewModel } from "@/modules/academic-calendar/review-view";

test("builds readable calendar review sections for a mixed faith-based institution", () => {
  const model = buildAcademicCalendarReviewModel(academyDataset.academicCalendar);

  assert.equal(model.summary.institutionName, "ChurchCore Academy");
  assert.equal(model.summary.calendarSystem, "Rolling enrollment");
  assert.equal(model.summary.termStructure, "Module");
  assert.equal(model.summary.timezone, "America/New_York");
  assert.equal(model.academicYears[0].subdivision, "Bible School");
  assert.equal(model.periods[0].academicYear, "2026 Ministry Training Reporting Year");
  assert.equal(model.periods[0].subdivision, "Bible School");
  assert.deepEqual(
    model.metrics.map((metric) => [metric.label, metric.value]),
    [
      ["Academic years", "2"],
      ["Periods", "2"],
      ["Subdivisions", "7"],
      ["Validation", "Clear"],
    ],
  );
  assert.deepEqual(model.validation, []);
});

test("resolves enrollment grading and transcript windows to their academic periods", () => {
  const model = buildAcademicCalendarReviewModel(academyDataset.academicCalendar);

  assert.equal(model.enrollmentWindows[0].period, "Acts Ministry Module");
  assert.equal(model.enrollmentWindows[0].type, "Application");
  assert.equal(model.enrollmentWindows[0].range, "Mar 1, 2026 - Open ended");
  assert.equal(model.gradingWindows[0].period, "Acts Ministry Module");
  assert.equal(model.gradingWindows[0].policy, "Registrar posting");
  assert.equal(model.transcriptPeriods[0].period, "Acts Ministry Module");
  assert.equal(model.transcriptPeriods[0].recordType, "Completion record");
});

test("surfaces calendar validation warnings for review", () => {
  const invalidConfig = {
    ...academyDataset.academicCalendar,
    institutionProfile: {
      ...academyDataset.academicCalendar.institutionProfile,
      operatingRules: {
        ...academyDataset.academicCalendar.institutionProfile.operatingRules,
        usesTranscripts: true,
      },
    },
    transcriptPeriods: [],
  };

  const model = buildAcademicCalendarReviewModel(invalidConfig);

  assert.deepEqual(model.validation, ["Transcript-bearing institutions must include at least one transcript period."]);
  assert.equal(model.metrics.find((metric) => metric.label === "Validation")?.value, "1");
  assert.equal(model.metrics.find((metric) => metric.label === "Validation")?.detail, "Warnings found");
});
