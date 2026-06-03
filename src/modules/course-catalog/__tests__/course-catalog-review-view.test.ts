import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { buildCourseCatalogReviewModel } from "@/modules/course-catalog/review-view";

test("builds a course setup review model for the seeded catalog", () => {
  const model = buildCourseCatalogReviewModel(academyDataset.courseCatalog);

  assert.equal(model.summary.institutionName, "ChurchCore Academy");
  assert.equal(model.summary.defaultRecordType, "Completion record");
  assert.deepEqual(
    model.metrics.map((metric) => [metric.label, metric.value]),
    [
      ["Courses", "4"],
      ["Sections", "3"],
      ["LMS mappings", "1"],
      ["Validation", "Clear"],
    ],
  );

  assert.deepEqual(
    model.courseCoverage.map((item) => [item.label, item.count]),
    [
      ["Bible course", 1],
      ["Chapel", 1],
      ["Children's class", 1],
      ["Ministry practicum", 1],
    ],
  );
  assert.deepEqual(
    model.recordCoverage.map((item) => [item.label, item.count]),
    [
      ["Attendance only", 1],
      ["Completion record", 2],
      ["Progress record", 1],
    ],
  );

  const actsCourse = model.courses.find((course) => course.code === "ACTS-MIN");
  assert.equal(actsCourse?.duration, "24 clock hours");
  assert.equal(actsCourse?.subdivision, "Bible School");

  const actsSection = model.sections.find((section) => section.sectionCode === "ACTS-MIN-1");
  assert.equal(actsSection?.period, "Acts Ministry Module");
  assert.equal(actsSection?.academicYear, "2026 Ministry Training Reporting Year");
  assert.equal(actsSection?.subdivision, "Ministry Training 2026");
  assert.equal(actsSection?.instructorStatus, "Assigned");

  assert.deepEqual(model.lmsMappings.map((mapping) => [mapping.provider, mapping.status, mapping.policy]), [["No LMS", "Not required", "Manual"]]);
  assert.deepEqual(model.validation, []);
});

test("surfaces validation warnings for course setup readiness", () => {
  const config = {
    ...academyDataset.courseCatalog,
    sections: academyDataset.courseCatalog.sections.map((section) =>
      section.id === "section-acts-ministry"
        ? {
            ...section,
            primaryInstructorId: undefined,
          }
        : section,
    ),
  };

  const model = buildCourseCatalogReviewModel(config);

  assert.equal(model.metrics.find((metric) => metric.label === "Validation")?.value, "1");
  assert.match(model.validation[0], /section-acts-ministry must include a primary instructor/);
  assert.equal(model.sections.find((section) => section.sectionCode === "ACTS-MIN-1")?.instructorStatus, "Needs assignment");
});
