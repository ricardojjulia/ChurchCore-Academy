import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import type { InstitutionMode } from "@/modules/academy-config/types";
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

test("derives multi-mode institutions from concrete selected modes", () => {
  const validProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-mixed",
    institutionName: "Kingdom Learning Institute",
    legalName: "Kingdom Learning Institute",
    primaryMode: "college",
    supportedModes: ["childrens_school", "college"],
  });

  assert.equal(validProfile.primaryMode, "college");
  assert.deepEqual(validProfile.supportedModes, ["childrens_school", "college"]);
  assert.equal(validProfile.operatingRules.usesGuardians, true);
  assert.equal(validProfile.operatingRules.usesTranscripts, true);
  assert.equal(validProfile.capabilities.guardianPortal, true);
  assert.equal(validProfile.capabilities.transcriptWorkflows, true);
  assert.deepEqual(validateInstitutionProfile(validProfile), []);
});

test("normalizes legacy mixed profiles while rejecting selectable mixed support", () => {
  const legacyProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-legacy-mixed",
    institutionName: "Legacy Institute",
    legalName: "Legacy Institute",
    primaryMode: "mixed",
    supportedModes: ["mixed", "childrens_school", "college"],
  });

  assert.equal(legacyProfile.primaryMode, "childrens_school");
  assert.deepEqual(legacyProfile.supportedModes, ["childrens_school", "college"]);

  const invalidProfile = {
    ...legacyProfile,
    primaryMode: "college" as const,
    supportedModes: ["mixed", "college"] as InstitutionMode[],
  };

  assert.deepEqual(validateInstitutionProfile(invalidProfile), [
    "Supported institution modes must be concrete modes; mixed is derived from multiple selected modes.",
  ]);
});

test("creates mode-pack defaults for youth and continuing education modes", () => {
  const youthProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-youth",
    institutionName: "Youth Seminary",
    legalName: "Youth Seminary",
    primaryMode: "youth_seminary",
  });

  assert.equal(youthProfile.operatingRules.usesGuardians, true);
  assert.equal(youthProfile.operatingRules.allowsMinors, true);
  assert.equal(youthProfile.operatingRules.officialRecordName, "progress_record");
  assert.equal(youthProfile.capabilities.guardianPortal, true);

  const continuingEducationProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-continuing",
    institutionName: "Continuing Education Institute",
    legalName: "Continuing Education Institute",
    primaryMode: "continuing_education",
  });

  assert.equal(continuingEducationProfile.operatingRules.defaultCalendarSystem, "rolling_enrollment");
  assert.equal(continuingEducationProfile.operatingRules.defaultTermStructure, "module");
  assert.equal(continuingEducationProfile.operatingRules.usesGpa, false);
  assert.equal(continuingEducationProfile.operatingRules.officialRecordName, "completion_record");
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
