import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import {
  evaluateOfficialRecords,
  OfficialRecordEntryEvaluation,
  OfficialRecordEvaluation,
} from "@/modules/grading-records/official-record-evaluator";
import { evaluateAcademicStanding } from "@/modules/grading-records/academic-standing-evaluator";
import { AcademicStandingRule, GradingRecordsConfiguration } from "@/modules/grading-records/types";

const now = "2026-06-02T00:00:00.000Z";

function collegeConfig(standingRules: AcademicStandingRule[] = []): GradingRecordsConfiguration {
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
        id: "band-d",
        tenantId: "tenant-grades",
        scaleId: "scale-letter",
        label: "D",
        minimumValue: 60,
        maximumValue: 69.99,
        gradePoints: 1,
        isPassing: true,
        isCompletion: true,
        officialRecordValue: "D",
        sequence: 4,
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
    standingRules,
  };
}

function postedCollegeRecords(config: GradingRecordsConfiguration, studentPersonId = "student-naomi"): OfficialRecordEvaluation {
  return evaluateOfficialRecords(config, [
    {
      id: "result-bibl-101",
      tenantId: "tenant-grades",
      studentPersonId,
      ruleSetId: "ruleset-bibl-101",
      scaleBandId: "band-a",
      creditsAttempted: 3,
      creditsEarned: 3,
      status: "approved_for_posting",
    },
    {
      id: "result-theo-201",
      tenantId: "tenant-grades",
      studentPersonId,
      ruleSetId: "ruleset-theo-201",
      scaleBandId: "band-a",
      creditsAttempted: 3,
      creditsEarned: 3,
      status: "approved_for_posting",
    },
  ]);
}

function completionEntry(overrides: Partial<OfficialRecordEntryEvaluation>): OfficialRecordEntryEvaluation {
  return {
    evaluationResultId: "result-completion",
    tenantId: "tenant-grades",
    studentPersonId: "student-naomi",
    ruleSetId: "ruleset-capstone",
    courseId: "course-capstone",
    recordType: "completion_record",
    recordValue: "capstone-complete",
    creditsAttempted: 0,
    creditsEarned: 0,
    clockHoursAttempted: 0,
    clockHoursEarned: 0,
    guardianVisible: false,
    includedInTranscript: false,
    includedInProgressReport: false,
    includedInCompletionRecord: true,
    includedInPromotion: false,
    includedInGraduationAudit: true,
    status: "posted",
    ...overrides,
  };
}

test("marks college students in good standing when GPA and credit thresholds are met", () => {
  const config = collegeConfig([
    {
      id: "standing-good",
      tenantId: "tenant-grades",
      name: "Good Standing",
      standingType: "good_standing",
      appliesToInstitutionMode: "college",
      minimumGpa: 2,
      minimumCreditsEarned: 6,
      status: "active",
    },
  ]);

  const result = evaluateAcademicStanding(config, postedCollegeRecords(config));
  const student = result.students[0];

  assert.deepEqual(result.warnings, []);
  assert.equal(student.summary.gpa, 4);
  assert.deepEqual(student.standingTypes, ["good_standing"]);
  assert.equal(student.appliedRules[0].status, "met");
});

test("marks probation when GPA falls below the configured threshold", () => {
  const config = collegeConfig([
    {
      id: "standing-probation",
      tenantId: "tenant-grades",
      name: "Academic Probation",
      standingType: "probation",
      appliesToInstitutionMode: "college",
      minimumGpa: 2,
      status: "active",
    },
  ]);
  const officialRecords = evaluateOfficialRecords(config, [
    {
      id: "result-bibl-101",
      tenantId: "tenant-grades",
      studentPersonId: "student-naomi",
      ruleSetId: "ruleset-bibl-101",
      scaleBandId: "band-d",
      creditsAttempted: 3,
      creditsEarned: 3,
      status: "approved_for_posting",
    },
  ]);

  const student = evaluateAcademicStanding(config, officialRecords).students[0];

  assert.deepEqual(student.standingTypes, ["probation"]);
  assert.deepEqual(student.blockers, ["GPA 1 is below required 2 for Academic Probation."]);
});

test("marks children's school promotion readiness when required competencies are present", () => {
  const config = collegeConfig([
    {
      id: "standing-promotion",
      tenantId: "tenant-child",
      name: "Grade Band Promotion Ready",
      standingType: "promotion_ready",
      appliesToInstitutionMode: "childrens_school",
      requiredCompetencies: ["reading-foundations"],
      promotionCriteria: "Teacher review and required competency progress complete.",
      status: "active",
    },
  ]);
  config.institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-child",
    institutionName: "Covenant Children's School",
    legalName: "Covenant Children's School",
    primaryMode: "childrens_school",
    now,
  });

  const result = evaluateAcademicStanding(config, {
    entries: [
      completionEntry({
        tenantId: "tenant-child",
        studentPersonId: "student-lena",
        recordType: "progress_record",
        recordValue: "Progress recorded",
        courseId: "course-reading-k5",
        competencySummary: "reading-foundations mastered",
        includedInCompletionRecord: false,
        includedInPromotion: true,
        includedInGraduationAudit: false,
      }),
    ],
    summary: {
      creditsAttempted: 0,
      creditsEarned: 0,
      clockHoursAttempted: 0,
      clockHoursEarned: 0,
      transcriptEntries: 0,
      progressEntries: 1,
      completionEntries: 0,
      heldEntries: 0,
      releasedEntries: 1,
    },
    warnings: [],
  });

  const student = result.students[0];

  assert.deepEqual(student.standingTypes, ["promotion_ready"]);
  assert.equal(student.promotionReady, true);
});

test("marks graduation readiness when GPA credits and required completion records are met", () => {
  const config = collegeConfig([
    {
      id: "standing-graduation-ready",
      tenantId: "tenant-grades",
      name: "Graduation Ready",
      standingType: "graduation_ready",
      appliesToInstitutionMode: "college",
      minimumGpa: 3,
      minimumCreditsEarned: 6,
      requiredCompletionRecords: ["course-capstone"],
      graduationCriteria: "Minimum GPA, credits, and capstone completion.",
      status: "active",
    },
  ]);
  const officialRecords = postedCollegeRecords(config);
  officialRecords.entries.push(completionEntry({}));

  const student = evaluateAcademicStanding(config, officialRecords).students[0];

  assert.deepEqual(student.standingTypes, ["graduation_ready"]);
  assert.equal(student.graduationReady, true);
  assert.deepEqual(student.blockers, []);
});

test("marks graduation blocked when requirements are missing or records are held", () => {
  const config = collegeConfig([
    {
      id: "standing-graduation-blocked",
      tenantId: "tenant-grades",
      name: "Graduation Blocked",
      standingType: "graduation_blocked",
      appliesToInstitutionMode: "college",
      minimumGpa: 3,
      minimumCreditsEarned: 120,
      requiredCompletionRecords: ["course-capstone"],
      graduationCriteria: "No holds, minimum credits, and required capstone completion.",
      status: "active",
    },
  ]);
  const officialRecords = postedCollegeRecords(config);
  officialRecords.entries.push(completionEntry({ status: "held" }));

  const student = evaluateAcademicStanding(config, officialRecords).students[0];

  assert.deepEqual(student.standingTypes, ["graduation_blocked"]);
  assert.equal(student.graduationBlocked, true);
  assert.deepEqual(student.blockers, [
    "Credits earned 6 are below required 120 for Graduation Blocked.",
    "Required completion record course-capstone is missing for Graduation Blocked.",
    "1 official record is held for Graduation Blocked.",
  ]);
});
