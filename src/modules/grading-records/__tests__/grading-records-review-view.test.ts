import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { buildGradingRecordsReviewModel } from "@/modules/grading-records/review-view";

test("builds a grading setup review model for the seeded grading configuration", () => {
  const model = buildGradingRecordsReviewModel(academyDataset.gradingRecords);

  assert.equal(model.summary.institutionName, "ChurchCore Academy");
  assert.equal(model.summary.defaultEvaluationType, "Pass fail");
  assert.equal(model.summary.defaultRecordType, "Completion record");
  assert.deepEqual(
    model.metrics.map((metric) => [metric.label, metric.value]),
    [
      ["Scales", "1"],
      ["Rule sets", "1"],
      ["Official rules", "1"],
      ["Standing rules", "1"],
      ["Validation", "Clear"],
    ],
  );

  assert.deepEqual(
    model.profile.map((item) => [item.label, item.value]),
    [
      ["Tenant", "cca-main"],
      ["Default evaluation", "Pass fail"],
      ["Default record type", "Completion record"],
      ["GPA", "Off"],
      ["Credits", "Off"],
      ["Clock hours", "Enabled"],
      ["Competencies", "Enabled"],
      ["Narrative evaluation", "Enabled"],
      ["Promotion", "Enabled"],
      ["Graduation audit", "Enabled"],
      ["Release policy", "Registrar release"],
      ["Guardian visibility", "Not applicable"],
    ],
  );

  assert.deepEqual(model.evaluationCoverage.map((item) => [item.label, item.count]), [["Pass fail", 1]]);
  assert.deepEqual(model.recordCoverage.map((item) => [item.label, item.count]), [["Completion record", 1]]);
  assert.equal(model.scales[0].name, "Ministry Completion Pass Fail");
  assert.deepEqual(model.scales[0].bands, ["Pass -> P", "Incomplete -> I"]);
  assert.equal(model.ruleSets[0].courseId, "course-acts-ministry");
  assert.equal(model.ruleSets[0].postingPolicy, "Registrar posting");
  assert.equal(model.officialRecordRules[0].inclusion, "Completion, Graduation audit");
  assert.equal(model.standingRules[0].standingType, "Graduation ready");
  assert.equal(model.standingRules[0].thresholds, "24 clock hours; completion course-acts-ministry");
  assert.deepEqual(model.validation, []);
});

test("surfaces validation warnings for grading setup readiness", () => {
  const config = {
    ...academyDataset.gradingRecords,
    ruleSets: academyDataset.gradingRecords.ruleSets.map((ruleSet) => ({
      ...ruleSet,
      lmsGradeReturnPolicy: "direct_post_to_official_record" as const,
    })),
  };

  const model = buildGradingRecordsReviewModel(config);

  assert.equal(model.metrics.find((metric) => metric.label === "Validation")?.value, "1");
  assert.match(model.validation[0], /cannot allow LMS grade return to post official records directly/);
  assert.equal(model.ruleSets[0].lmsGradeReturnPolicy, "Direct post to official record");
});
