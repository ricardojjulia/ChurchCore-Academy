import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { validateInstitutionProfile } from "@/modules/academy-config/validation";

test("creates children's school defaults with guardian support and school-year records", () => {
  const profile = createInstitutionProfileDefaults({
    tenantId: "tenant-childrens-school",
    institutionName: "Grace Christian School",
    legalName: "Grace Christian School Inc.",
    primaryMode: "childrens_school",
  });

  assert.deepEqual(profile.supportedModes, ["childrens_school"]);
  assert.equal(profile.operatingRules.defaultCalendarSystem, "school_year");
  assert.equal(profile.operatingRules.defaultTermStructure, "trimester");
  assert.equal(profile.operatingRules.usesGradeLevels, true);
  assert.equal(profile.operatingRules.usesGuardians, true);
  assert.equal(profile.operatingRules.allowsMinors, true);
  assert.equal(profile.operatingRules.defaultInstructionalRoleLabel, "teacher");
  assert.equal(profile.operatingRules.officialRecordName, "progress_record");
  assert.equal(profile.capabilities.guardianPortal, true);
  assert.equal(profile.lmsPreference.provider, "none");
  assert.deepEqual(validateInstitutionProfile(profile), []);
});

test("creates postsecondary defaults with transcript and credit support", () => {
  const profile = createInstitutionProfileDefaults({
    tenantId: "tenant-seminary",
    institutionName: "Covenant Seminary",
    legalName: "Covenant Seminary",
    primaryMode: "seminary",
    lmsProvider: "moodle",
  });

  assert.deepEqual(profile.supportedModes, ["seminary"]);
  assert.equal(profile.operatingRules.defaultCalendarSystem, "academic_year");
  assert.equal(profile.operatingRules.defaultTermStructure, "semester");
  assert.equal(profile.operatingRules.usesCredits, true);
  assert.equal(profile.operatingRules.usesGpa, true);
  assert.equal(profile.operatingRules.usesTranscripts, true);
  assert.equal(profile.operatingRules.defaultInstructionalRoleLabel, "professor");
  assert.equal(profile.operatingRules.officialRecordName, "transcript");
  assert.equal(profile.lmsPreference.provider, "moodle");
  assert.equal(profile.lmsPreference.selectionStatus, "planned");
  assert.deepEqual(validateInstitutionProfile(profile), []);
});

test("supports mixed institutions only when concrete modes are present", () => {
  const validProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-mixed",
    institutionName: "Kingdom Learning Institute",
    legalName: "Kingdom Learning Institute",
    primaryMode: "mixed",
    supportedModes: ["mixed", "childrens_school", "college"],
  });

  assert.deepEqual(validateInstitutionProfile(validProfile), []);

  const invalidProfile = {
    ...validProfile,
    supportedModes: ["mixed"],
  };

  assert.deepEqual(validateInstitutionProfile(invalidProfile), [
    "Mixed institutions must include at least two concrete institution modes.",
  ]);
});

test("rejects incompatible operating rule and LMS capability combinations", () => {
  const profile = createInstitutionProfileDefaults({
    tenantId: "tenant-invalid",
    institutionName: "Invalid Academy",
    legalName: "Invalid Academy",
    primaryMode: "college",
  });

  const invalidProfile = {
    ...profile,
    operatingRules: {
      ...profile.operatingRules,
      allowsMinors: true,
      usesGuardians: false,
      usesCredits: false,
      usesClockHours: false,
    },
    capabilities: {
      ...profile.capabilities,
      guardianPortal: true,
      lmsRosterSync: true,
      lmsGradeReturn: true,
    },
    lmsPreference: {
      ...profile.lmsPreference,
      provider: "none" as const,
    },
  };

  assert.deepEqual(validateInstitutionProfile(invalidProfile), [
    "Institutions that allow minors must enable guardian support.",
    "Guardian portal requires guardian support in operating rules.",
    "LMS roster sync requires Moodle or Canvas as the LMS provider.",
    "LMS grade return requires Moodle or Canvas as the LMS provider.",
    "Transcript-bearing postsecondary institutions must use credits or clock hours.",
  ]);
});
