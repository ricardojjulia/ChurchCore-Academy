import assert from "node:assert/strict";
import test from "node:test";
import {
  concreteInstitutionModes,
  getInstitutionModePack,
  normalizeSelectedInstitutionModes,
  resolveInstitutionModel,
} from "@/modules/academy-config/mode-packs";

test("mode taxonomy contains only concrete selectable modes", () => {
  assert.equal(concreteInstitutionModes.includes("mixed" as never), false);
  assert.deepEqual(concreteInstitutionModes, [
    "bible_school",
    "seminary",
    "college",
    "university",
    "childrens_school",
    "youth_seminary",
    "ministry_training_center",
    "continuing_education",
    "homeschool_hybrid",
  ]);
});

test("every concrete mode has an operational mode pack", () => {
  for (const mode of concreteInstitutionModes) {
    const pack = getInstitutionModePack(mode);
    assert.equal(pack.mode, mode);
    assert.notEqual(pack.label, "");
    assert.notEqual(pack.description, "");
    assert.ok(pack.workflowTemplates.length > 0);
    assert.ok(pack.recommendedSubdivisionTypes.length > 0);
  }
});

test("normalizes legacy mixed selections to concrete modes", () => {
  assert.deepEqual(
    normalizeSelectedInstitutionModes(["mixed", "seminary", "childrens_school"]),
    ["seminary", "childrens_school"],
  );
  assert.deepEqual(normalizeSelectedInstitutionModes(["mixed"]), ["college"]);
});

test("derives single-mode or multi-mode status from selected concrete modes", () => {
  assert.equal(resolveInstitutionModel(["seminary"]), "single_mode");
  assert.equal(resolveInstitutionModel(["seminary", "childrens_school"]), "multi_mode");
});
