import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { buildInstitutionReviewModel } from "@/modules/academy-config/review-view";

test("builds readable review sections for a mixed faith-based institution", () => {
  const profile = createInstitutionProfileDefaults({
    tenantId: "tenant-review",
    institutionName: "Kingdom Learning Institute",
    legalName: "Kingdom Learning Institute",
    primaryMode: "college",
    supportedModes: ["bible_school", "childrens_school", "college"],
    lmsProvider: "moodle",
  });

  const model = buildInstitutionReviewModel(profile);

  assert.equal(model.identity.institutionName, "Kingdom Learning Institute");
  assert.equal(model.identity.institutionModel, "Multi-mode");
  assert.equal(model.identity.primaryMode, "College");
  assert.deepEqual(model.identity.supportedModes, ["Bible school", "Children's school", "College"]);
  assert.deepEqual(model.identity.modePacks, ["Bible school", "Children's school", "College"]);
  assert.equal(model.operatingRules.find((item) => item.label === "Calendar")?.value, "Academic year");
  assert.equal(model.capabilities.find((item) => item.label === "Student PWA")?.status, "enabled");
  assert.equal(model.lms.provider, "Moodle");
  assert.equal(model.lms.selectionStatus, "Planned");
  assert.deepEqual(model.validation, []);
});

test("surfaces validation warnings for incompatible review configuration", () => {
  const profile = createInstitutionProfileDefaults({
    tenantId: "tenant-warning",
    institutionName: "Warning Academy",
    legalName: "Warning Academy",
    primaryMode: "college",
  });

  const model = buildInstitutionReviewModel({
    ...profile,
    capabilities: {
      ...profile.capabilities,
      lmsRosterSync: true,
    },
    lmsPreference: {
      ...profile.lmsPreference,
      provider: "none",
    },
  });

  assert.deepEqual(model.validation, ["LMS roster sync requires Moodle or Canvas as the LMS provider."]);
});
