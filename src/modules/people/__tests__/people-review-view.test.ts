import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { buildPeopleReviewModel } from "@/modules/people/review-view";

test("builds a people and role review model for the seeded configuration", () => {
  const model = buildPeopleReviewModel(academyDataset.peopleConfiguration);

  assert.equal(model.summary.institutionName, "ChurchCore Academy");
  assert.deepEqual(
    model.metrics.map((metric) => [metric.label, metric.value]),
    [
      ["People", "5"],
      ["Students", "1"],
      ["Staff", "3"],
      ["Guardians", "1"],
      ["Validation", "Clear"],
    ],
  );

  assert.deepEqual(
    model.roleCoverage.map((item) => [item.label, item.count]),
    [
      ["Advisor", 1],
      ["Guardian", 1],
      ["Registrar", 1],
      ["Student", 1],
      ["Teacher", 1],
    ],
  );

  const childStudent = model.students.find((student) => student.studentNumber === "CHILD-1001");
  assert.equal(childStudent?.displayName, "Lena Rivera");
  assert.equal(childStudent?.guardianStatus, "Guardian linked");
  assert.equal(childStudent?.advisor, "Julian Pace");

  assert.deepEqual(model.relationships.map((relationship) => [relationship.student, relationship.relatedPerson, relationship.visibility]), [
    ["Lena Rivera", "Marisol Rivera", "Full guardian"],
    ["Lena Rivera", "Sophia Marsh", "Progress"],
    ["Lena Rivera", "Julian Pace", "Progress"],
  ]);
  assert.deepEqual(model.validation, []);
});

test("surfaces people validation warnings and missing relationship readiness", () => {
  const config = {
    ...academyDataset.peopleConfiguration,
    relationships: academyDataset.peopleConfiguration.relationships.filter((relationship) => relationship.relationshipType !== "guardian"),
  };

  const model = buildPeopleReviewModel(config);

  assert.equal(model.metrics.find((metric) => metric.label === "Validation")?.value, "2");
  assert.match(model.validation[0], /Guardian role assignment role-marisol-guardian-lena/);
  assert.match(model.validation[1], /Child student profile student-profile-lena/);
  assert.equal(model.students.find((student) => student.studentNumber === "CHILD-1001")?.guardianStatus, "Needs guardian");
});
