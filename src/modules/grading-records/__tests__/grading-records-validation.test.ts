import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { GradingRecordsConfiguration, validateGradingRecordsConfiguration } from "@/modules/grading-records/validation";

const now = "2026-06-02T00:00:00.000Z";

function baseCollegeConfig(overrides: Partial<GradingRecordsConfiguration> = {}): GradingRecordsConfiguration {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-grades",
    institutionName: "Grace College",
    legalName: "Grace College",
    primaryMode: "college",
    now,
  });

  return {
    institutionProfile,
    gradingProfile: {
      tenantId: "tenant-grades",
      defaultEvaluationType: "letter_grade",
      defaultOfficialRecordType: "transcript",
      supportsGpa: true,
      supportsCredits: true,
      supportsClockHours: false,
      supportsCompetencies: false,
      supportsNarrativeEvaluation: false,
      supportsPromotion: false,
      supportsGraduationAudit: true,
      gradeReleasePolicy: "registrar_release",
      guardianVisibilityPolicy: "not_applicable",
      createdAt: now,
      updatedAt: now,
    },
    scales: [
      {
        id: "scale-letter-undergrad",
        tenantId: "tenant-grades",
        name: "Undergraduate Letter Scale",
        scaleType: "letter_grade",
        appliesToRecordType: "transcript",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    scaleBands: [
      {
        id: "band-a",
        tenantId: "tenant-grades",
        scaleId: "scale-letter-undergrad",
        label: "A",
        minimumValue: 90,
        maximumValue: 100,
        gradePoints: 4,
        isPassing: true,
        isCompletion: true,
        officialRecordValue: "A",
        sequence: 1,
      },
      {
        id: "band-b",
        tenantId: "tenant-grades",
        scaleId: "scale-letter-undergrad",
        label: "B",
        minimumValue: 80,
        maximumValue: 89.99,
        gradePoints: 3,
        isPassing: true,
        isCompletion: true,
        officialRecordValue: "B",
        sequence: 2,
      },
      {
        id: "band-f",
        tenantId: "tenant-grades",
        scaleId: "scale-letter-undergrad",
        label: "F",
        minimumValue: 0,
        maximumValue: 59.99,
        gradePoints: 0,
        isPassing: false,
        isCompletion: false,
        officialRecordValue: "F",
        sequence: 5,
      },
    ],
    ruleSets: [
      {
        id: "ruleset-bibl-101",
        tenantId: "tenant-grades",
        courseId: "course-bibl-101",
        evaluationType: "letter_grade",
        scaleId: "scale-letter-undergrad",
        recordType: "transcript",
        gpaPolicy: "included",
        creditPolicy: "attempted_and_earned",
        clockHourPolicy: "not_applicable",
        competencyPolicy: "not_applicable",
        narrativePolicy: "not_required",
        postingPolicy: "registrar_posting",
        lmsGradeReturnPolicy: "manual_entry_only",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    officialRecordRules: [
      {
        id: "record-transcript",
        tenantId: "tenant-grades",
        recordType: "transcript",
        appliesToInstitutionMode: "college",
        postingAuthority: "registrar",
        releasePolicy: "registrar_release",
        includedInTranscript: true,
        includedInProgressReport: false,
        includedInCompletionRecord: false,
        includedInPromotion: false,
        includedInGraduationAudit: true,
        status: "active",
      },
    ],
    standingRules: [
      {
        id: "standing-probation",
        tenantId: "tenant-grades",
        name: "Academic Probation",
        standingType: "probation",
        appliesToInstitutionMode: "college",
        minimumGpa: 2,
        minimumCreditsEarned: 12,
        status: "active",
      },
    ],
    ...overrides,
  };
}

test("accepts a college GPA transcript grading configuration", () => {
  assert.deepEqual(validateGradingRecordsConfiguration(baseCollegeConfig()), []);
});

test("accepts a Bible school pass/fail completion configuration without GPA", () => {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-bible",
    institutionName: "Bible Training Institute",
    legalName: "Bible Training Institute",
    primaryMode: "bible_school",
    now,
  });

  const config: GradingRecordsConfiguration = {
    ...baseCollegeConfig(),
    institutionProfile,
    gradingProfile: {
      ...baseCollegeConfig().gradingProfile,
      tenantId: "tenant-bible",
      defaultEvaluationType: "pass_fail",
      defaultOfficialRecordType: "completion_record",
      supportsGpa: false,
      supportsCredits: false,
      supportsClockHours: true,
      supportsGraduationAudit: false,
    },
    scales: [
      {
        id: "scale-pass-fail",
        tenantId: "tenant-bible",
        name: "Pass Fail Completion",
        scaleType: "pass_fail",
        appliesToRecordType: "completion_record",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    scaleBands: [
      {
        id: "band-pass",
        tenantId: "tenant-bible",
        scaleId: "scale-pass-fail",
        label: "Pass",
        isPassing: true,
        isCompletion: true,
        officialRecordValue: "P",
        sequence: 1,
      },
      {
        id: "band-fail",
        tenantId: "tenant-bible",
        scaleId: "scale-pass-fail",
        label: "Fail",
        isPassing: false,
        isCompletion: false,
        officialRecordValue: "F",
        sequence: 2,
      },
    ],
    ruleSets: [
      {
        id: "ruleset-acts-module",
        tenantId: "tenant-bible",
        courseId: "course-acts-module",
        evaluationType: "pass_fail",
        scaleId: "scale-pass-fail",
        recordType: "completion_record",
        gpaPolicy: "not_applicable",
        creditPolicy: "not_applicable",
        clockHourPolicy: "attempted_and_earned",
        competencyPolicy: "not_applicable",
        narrativePolicy: "optional",
        postingPolicy: "registrar_posting",
        lmsGradeReturnPolicy: "manual_entry_only",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    officialRecordRules: [
      {
        id: "record-completion",
        tenantId: "tenant-bible",
        recordType: "completion_record",
        appliesToInstitutionMode: "bible_school",
        postingAuthority: "registrar",
        releasePolicy: "registrar_release",
        includedInTranscript: false,
        includedInProgressReport: false,
        includedInCompletionRecord: true,
        includedInPromotion: false,
        includedInGraduationAudit: false,
        status: "active",
      },
    ],
    standingRules: [],
  };

  assert.deepEqual(validateGradingRecordsConfiguration(config), []);
});

test("accepts a children's school narrative progress configuration with guardian release policy", () => {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-child",
    institutionName: "Covenant Children's School",
    legalName: "Covenant Children's School",
    primaryMode: "childrens_school",
    now,
  });

  const config: GradingRecordsConfiguration = {
    ...baseCollegeConfig(),
    institutionProfile,
    gradingProfile: {
      ...baseCollegeConfig().gradingProfile,
      tenantId: "tenant-child",
      defaultEvaluationType: "narrative",
      defaultOfficialRecordType: "progress_record",
      supportsGpa: false,
      supportsCredits: false,
      supportsClockHours: false,
      supportsCompetencies: true,
      supportsNarrativeEvaluation: true,
      supportsPromotion: true,
      supportsGraduationAudit: false,
      gradeReleasePolicy: "teacher_releases_after_review",
      guardianVisibilityPolicy: "guardian_relationship_required",
    },
    scales: [
      {
        id: "scale-narrative",
        tenantId: "tenant-child",
        name: "Narrative Progress",
        scaleType: "narrative",
        appliesToRecordType: "progress_record",
        narrativeRequired: true,
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    scaleBands: [],
    ruleSets: [
      {
        id: "ruleset-reading-progress",
        tenantId: "tenant-child",
        courseId: "course-reading-k5",
        evaluationType: "narrative",
        scaleId: "scale-narrative",
        recordType: "progress_record",
        gpaPolicy: "not_applicable",
        creditPolicy: "not_applicable",
        clockHourPolicy: "not_applicable",
        competencyPolicy: "progress_summary",
        narrativePolicy: "required",
        postingPolicy: "teacher_submit_registrar_release",
        lmsGradeReturnPolicy: "manual_entry_only",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    officialRecordRules: [
      {
        id: "record-progress",
        tenantId: "tenant-child",
        recordType: "progress_record",
        appliesToInstitutionMode: "childrens_school",
        postingAuthority: "academic_admin",
        releasePolicy: "guardian_release_after_review",
        includedInTranscript: false,
        includedInProgressReport: true,
        includedInCompletionRecord: false,
        includedInPromotion: true,
        includedInGraduationAudit: false,
        status: "active",
      },
    ],
    standingRules: [
      {
        id: "standing-promotion-ready",
        tenantId: "tenant-child",
        name: "Grade Band Promotion Ready",
        standingType: "promotion_ready",
        appliesToInstitutionMode: "childrens_school",
        requiredCompetencies: ["reading-foundations"],
        promotionCriteria: "Teacher review and guardian-visible progress record complete.",
        status: "active",
      },
    ],
  };

  assert.deepEqual(validateGradingRecordsConfiguration(config), []);
});

test("accepts a seminary transcript configuration with LMS grade return review", () => {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-seminary",
    institutionName: "Faith Seminary",
    legalName: "Faith Seminary",
    primaryMode: "seminary",
    lmsProvider: "moodle",
    now,
  });

  const config: GradingRecordsConfiguration = {
    ...baseCollegeConfig(),
    institutionProfile,
    gradingProfile: {
      ...baseCollegeConfig().gradingProfile,
      tenantId: "tenant-seminary",
      defaultEvaluationType: "letter_grade",
      defaultOfficialRecordType: "transcript",
      supportsGpa: true,
      supportsCredits: true,
      gradeReleasePolicy: "registrar_release",
      guardianVisibilityPolicy: "not_applicable",
    },
    scales: [
      {
        ...baseCollegeConfig().scales[0],
        id: "scale-graduate-letter",
        tenantId: "tenant-seminary",
        name: "Graduate Letter Scale",
      },
    ],
    scaleBands: baseCollegeConfig().scaleBands.map((band) => ({
      ...band,
      tenantId: "tenant-seminary",
      scaleId: "scale-graduate-letter",
    })),
    ruleSets: [
      {
        ...baseCollegeConfig().ruleSets[0],
        id: "ruleset-theology-601",
        tenantId: "tenant-seminary",
        courseId: "course-theology-601",
        scaleId: "scale-graduate-letter",
        lmsGradeReturnPolicy: "review_before_posting",
      },
    ],
    officialRecordRules: [
      {
        ...baseCollegeConfig().officialRecordRules[0],
        id: "record-seminary-transcript",
        tenantId: "tenant-seminary",
        appliesToInstitutionMode: "seminary",
      },
    ],
    standingRules: [
      {
        ...baseCollegeConfig().standingRules[0],
        id: "standing-seminary-probation",
        tenantId: "tenant-seminary",
        appliesToInstitutionMode: "seminary",
        minimumGpa: 2.5,
      },
    ],
  };

  assert.deepEqual(validateGradingRecordsConfiguration(config), []);
});

test("rejects cross-tenant grading records and references", () => {
  const config = baseCollegeConfig({
    gradingProfile: {
      ...baseCollegeConfig().gradingProfile,
      tenantId: "other-tenant",
    },
    scales: [
      {
        ...baseCollegeConfig().scales[0],
        tenantId: "other-tenant",
      },
    ],
    ruleSets: [
      {
        ...baseCollegeConfig().ruleSets[0],
        scaleId: "missing-scale",
      },
    ],
  });

  const errors = validateGradingRecordsConfiguration(config);

  assert.match(errors.join("\n"), /Grading profile tenant must match the institution tenant/);
  assert.match(errors.join("\n"), /Evaluation scale scale-letter-undergrad tenant must match the institution tenant/);
  assert.match(errors.join("\n"), /Evaluation rule set ruleset-bibl-101 must reference an existing scale/);
});

test("rejects GPA policies when the institution does not support GPA", () => {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-bible",
    institutionName: "Bible Training Institute",
    legalName: "Bible Training Institute",
    primaryMode: "bible_school",
    now,
  });
  const config = baseCollegeConfig({
    institutionProfile,
    gradingProfile: {
      ...baseCollegeConfig().gradingProfile,
      tenantId: "tenant-bible",
      supportsGpa: true,
    },
    ruleSets: [
      {
        ...baseCollegeConfig().ruleSets[0],
        tenantId: "tenant-bible",
        gpaPolicy: "included",
      },
    ],
  });

  const errors = validateGradingRecordsConfiguration(config);

  assert.match(errors.join("\n"), /Grading profile cannot support GPA when institution operating rules disable GPA/);
  assert.match(errors.join("\n"), /Evaluation rule set ruleset-bibl-101 cannot include GPA when GPA is not supported/);
});

test("rejects overlapping numeric scale bands and non-GPA grade points", () => {
  const config = baseCollegeConfig({
    scales: [
      {
        ...baseCollegeConfig().scales[0],
        scaleType: "pass_fail",
      },
    ],
    scaleBands: [
      {
        ...baseCollegeConfig().scaleBands[0],
        maximumValue: 95,
        gradePoints: 4,
      },
      {
        ...baseCollegeConfig().scaleBands[1],
        minimumValue: 90,
        maximumValue: 100,
        gradePoints: 3,
      },
    ],
  });

  const errors = validateGradingRecordsConfiguration(config);

  assert.match(errors.join("\n"), /Evaluation scale scale-letter-undergrad uses pass_fail and must not include grade points/);
  assert.match(errors.join("\n"), /Evaluation scale scale-letter-undergrad has overlapping numeric bands/);
});

test("rejects incompatible scale and evaluation rule combinations", () => {
  const config = baseCollegeConfig({
    ruleSets: [
      {
        ...baseCollegeConfig().ruleSets[0],
        evaluationType: "narrative",
        narrativePolicy: "required",
      },
    ],
  });

  assert.deepEqual(validateGradingRecordsConfiguration(config), [
    "Evaluation rule set ruleset-bibl-101 evaluation type must match scale scale-letter-undergrad.",
    "Evaluation rule set ruleset-bibl-101 requires narrative support from the grading profile.",
  ]);
});

test("requires transcript-bearing institutions to define transcript posting rules", () => {
  const config = baseCollegeConfig({
    officialRecordRules: [],
  });

  assert.deepEqual(validateGradingRecordsConfiguration(config), [
    "Transcript-bearing institutions must define at least one active transcript official record rule.",
  ]);
});

test("rejects LMS grade return policies that bypass Academy review", () => {
  const config = baseCollegeConfig({
    ruleSets: [
      {
        ...baseCollegeConfig().ruleSets[0],
        lmsGradeReturnPolicy: "direct_post_to_official_record",
      },
    ],
  });

  assert.deepEqual(validateGradingRecordsConfiguration(config), [
    "Evaluation rule set ruleset-bibl-101 cannot allow LMS grade return to post official records directly.",
  ]);
});
