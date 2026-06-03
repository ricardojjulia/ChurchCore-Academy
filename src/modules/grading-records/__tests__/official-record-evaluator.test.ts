import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { evaluateOfficialRecords } from "@/modules/grading-records/official-record-evaluator";
import { GradingRecordsConfiguration } from "@/modules/grading-records/types";

const now = "2026-06-02T00:00:00.000Z";

function collegeConfig(): GradingRecordsConfiguration {
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
        id: "scale-letter",
        tenantId: "tenant-grades",
        name: "Letter Scale",
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
        scaleId: "scale-letter",
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
        scaleId: "scale-letter",
        label: "B",
        minimumValue: 80,
        maximumValue: 89.99,
        gradePoints: 3,
        isPassing: true,
        isCompletion: true,
        officialRecordValue: "B",
        sequence: 2,
      },
    ],
    ruleSets: [
      {
        id: "ruleset-bibl-101",
        tenantId: "tenant-grades",
        courseId: "course-bibl-101",
        evaluationType: "letter_grade",
        scaleId: "scale-letter",
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
      {
        id: "ruleset-theo-201",
        tenantId: "tenant-grades",
        courseId: "course-theo-201",
        evaluationType: "letter_grade",
        scaleId: "scale-letter",
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
    standingRules: [],
  };
}

test("evaluates college transcript entries and GPA summary from approved results", () => {
  const result = evaluateOfficialRecords(collegeConfig(), [
    {
      id: "result-bibl-101",
      tenantId: "tenant-grades",
      studentPersonId: "student-naomi",
      ruleSetId: "ruleset-bibl-101",
      scaleBandId: "band-a",
      creditsAttempted: 3,
      creditsEarned: 3,
      status: "approved_for_posting",
      academicYearId: "year-2026",
      academicPeriodId: "term-fall",
    },
    {
      id: "result-theo-201",
      tenantId: "tenant-grades",
      studentPersonId: "student-naomi",
      ruleSetId: "ruleset-theo-201",
      rawValue: 84,
      creditsAttempted: 3,
      creditsEarned: 3,
      status: "approved_for_posting",
      academicYearId: "year-2026",
      academicPeriodId: "term-fall",
    },
  ]);

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.entries.map((entry) => [entry.recordType, entry.recordValue, entry.gradePoints, entry.status]), [
    ["transcript", "A", 4, "posted"],
    ["transcript", "B", 3, "posted"],
  ]);
  assert.equal(result.summary.gpa, 3.5);
  assert.equal(result.summary.creditsAttempted, 6);
  assert.equal(result.summary.creditsEarned, 6);
  assert.equal(result.summary.releasedEntries, 2);
});

test("evaluates Bible school completion records without GPA", () => {
  const config = collegeConfig();
  config.institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-bible",
    institutionName: "Bible Training Institute",
    legalName: "Bible Training Institute",
    primaryMode: "bible_school",
    now,
  });
  config.gradingProfile = {
    ...config.gradingProfile,
    tenantId: "tenant-bible",
    defaultEvaluationType: "pass_fail",
    defaultOfficialRecordType: "completion_record",
    supportsGpa: false,
    supportsCredits: false,
    supportsClockHours: true,
    supportsGraduationAudit: false,
  };
  config.scales = [{ ...config.scales[0], id: "scale-pass-fail", tenantId: "tenant-bible", scaleType: "pass_fail", appliesToRecordType: "completion_record" }];
  config.scaleBands = [
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
  ];
  config.ruleSets = [
    {
      ...config.ruleSets[0],
      id: "ruleset-acts",
      tenantId: "tenant-bible",
      courseId: "course-acts",
      evaluationType: "pass_fail",
      scaleId: "scale-pass-fail",
      recordType: "completion_record",
      gpaPolicy: "not_applicable",
      creditPolicy: "not_applicable",
      clockHourPolicy: "attempted_and_earned",
    },
  ];
  config.officialRecordRules = [
    {
      ...config.officialRecordRules[0],
      id: "record-completion",
      tenantId: "tenant-bible",
      recordType: "completion_record",
      appliesToInstitutionMode: "bible_school",
      includedInTranscript: false,
      includedInCompletionRecord: true,
      includedInGraduationAudit: false,
    },
  ];

  const result = evaluateOfficialRecords(config, [
    {
      id: "result-acts",
      tenantId: "tenant-bible",
      studentPersonId: "student-ezra",
      ruleSetId: "ruleset-acts",
      scaleBandId: "band-pass",
      clockHoursAttempted: 24,
      clockHoursEarned: 24,
      status: "approved_for_posting",
    },
  ]);

  assert.deepEqual(result.warnings, []);
  assert.equal(result.entries[0].recordType, "completion_record");
  assert.equal(result.entries[0].recordValue, "P");
  assert.equal(result.entries[0].clockHoursEarned, 24);
  assert.equal(result.summary.gpa, undefined);
  assert.equal(result.summary.completionEntries, 1);
});

test("evaluates children's school progress records as guardian-releasable narrative entries", () => {
  const config = collegeConfig();
  config.institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-child",
    institutionName: "Covenant Children's School",
    legalName: "Covenant Children's School",
    primaryMode: "childrens_school",
    now,
  });
  config.gradingProfile = {
    ...config.gradingProfile,
    tenantId: "tenant-child",
    defaultEvaluationType: "narrative",
    defaultOfficialRecordType: "progress_record",
    supportsGpa: false,
    supportsCredits: false,
    supportsCompetencies: true,
    supportsNarrativeEvaluation: true,
    supportsPromotion: true,
    supportsGraduationAudit: false,
    gradeReleasePolicy: "teacher_releases_after_review",
    guardianVisibilityPolicy: "guardian_relationship_required",
  };
  config.scales = [{ ...config.scales[0], id: "scale-narrative", tenantId: "tenant-child", scaleType: "narrative", appliesToRecordType: "progress_record", narrativeRequired: true }];
  config.scaleBands = [];
  config.ruleSets = [
    {
      ...config.ruleSets[0],
      id: "ruleset-reading",
      tenantId: "tenant-child",
      courseId: "course-reading-k5",
      evaluationType: "narrative",
      scaleId: "scale-narrative",
      recordType: "progress_record",
      gpaPolicy: "not_applicable",
      creditPolicy: "not_applicable",
      competencyPolicy: "progress_summary",
      narrativePolicy: "required",
      postingPolicy: "teacher_submit_registrar_release",
    },
  ];
  config.officialRecordRules = [
    {
      ...config.officialRecordRules[0],
      id: "record-progress",
      tenantId: "tenant-child",
      recordType: "progress_record",
      appliesToInstitutionMode: "childrens_school",
      postingAuthority: "academic_admin",
      releasePolicy: "guardian_release_after_review",
      includedInTranscript: false,
      includedInProgressReport: true,
      includedInGraduationAudit: false,
    },
  ];

  const result = evaluateOfficialRecords(config, [
    {
      id: "result-reading",
      tenantId: "tenant-child",
      studentPersonId: "student-lena",
      ruleSetId: "ruleset-reading",
      narrative: "Lena is reading confidently at grade-band expectation.",
      status: "approved_for_posting",
    },
  ]);

  assert.deepEqual(result.warnings, []);
  assert.equal(result.entries[0].recordType, "progress_record");
  assert.equal(result.entries[0].recordValue, "Progress recorded");
  assert.equal(result.entries[0].guardianVisible, true);
  assert.equal(result.entries[0].narrative, "Lena is reading confidently at grade-band expectation.");
  assert.equal(result.summary.progressEntries, 1);
});

test("holds seminary transcript entries when the release policy is manual hold", () => {
  const config = collegeConfig();
  config.officialRecordRules = [
    {
      ...config.officialRecordRules[0],
      releasePolicy: "manual_hold",
      appliesToInstitutionMode: "college",
    },
  ];

  const result = evaluateOfficialRecords(config, [
    {
      id: "result-held",
      tenantId: "tenant-grades",
      studentPersonId: "student-daniel",
      ruleSetId: "ruleset-bibl-101",
      scaleBandId: "band-b",
      creditsAttempted: 3,
      creditsEarned: 3,
      status: "approved_for_posting",
    },
  ]);

  assert.equal(result.entries[0].status, "held");
  assert.equal(result.summary.heldEntries, 1);
  assert.equal(result.summary.releasedEntries, 0);
});

test("warns and skips submitted LMS grade return results until reviewed", () => {
  const config = collegeConfig();
  config.ruleSets = [
    {
      ...config.ruleSets[0],
      lmsGradeReturnPolicy: "review_before_posting",
    },
  ];

  const result = evaluateOfficialRecords(config, [
    {
      id: "result-lms",
      tenantId: "tenant-grades",
      studentPersonId: "student-naomi",
      ruleSetId: "ruleset-bibl-101",
      rawValue: 95,
      creditsAttempted: 3,
      creditsEarned: 3,
      sourceType: "lms_grade_return",
      status: "submitted",
    },
  ]);

  assert.deepEqual(result.entries, []);
  assert.deepEqual(result.warnings, ["Evaluation result result-lms must be approved before official record posting."]);
});
