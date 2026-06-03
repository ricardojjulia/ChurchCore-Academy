import assert from "node:assert/strict";
import test from "node:test";
import { AcademyGradingRecordsRepository, mapGradingRecordsRows } from "@/modules/grading-records/postgres-repository";
import { validateGradingRecordsConfiguration } from "@/modules/grading-records/validation";

const now = new Date("2026-06-02T00:00:00.000Z");

const rows = {
  institutionProfile: {
    tenant_id: "tenant-grading",
    institution_name: "Grading Repository Academy",
    legal_name: "Grading Repository Academy Inc.",
    primary_mode: "college",
    supported_modes: JSON.stringify(["college"]),
    operating_rules: JSON.stringify({
      academicYearLabel: "Academic Year",
      defaultCalendarSystem: "academic_year",
      defaultTermStructure: "semester",
      usesGradeLevels: false,
      usesPrograms: true,
      usesCohorts: true,
      usesCredits: true,
      usesClockHours: false,
      usesGpa: true,
      usesTranscripts: true,
      usesGuardians: false,
      allowsMinors: false,
      defaultInstructionalRoleLabel: "professor",
      officialRecordName: "transcript",
    }),
    capabilities: JSON.stringify({
      studentPwa: true,
      guardianPortal: false,
      facultyPortal: true,
      registrarWorkflows: true,
      admissionsWorkflows: true,
      transcriptWorkflows: true,
      graduationWorkflows: true,
      lmsLaunch: false,
      lmsRosterSync: false,
      lmsGradeReturn: false,
      shepherdAiRecommendations: true,
    }),
    lms_preference: JSON.stringify({ provider: "none", selectionStatus: "not_needed" }),
    created_at: now,
    updated_at: now,
  },
  gradingProfile: {
    tenant_id: "tenant-grading",
    default_evaluation_type: "letter_grade",
    default_official_record_type: "transcript",
    supports_gpa: true,
    supports_credits: true,
    supports_clock_hours: false,
    supports_competencies: false,
    supports_narrative_evaluation: false,
    supports_promotion: false,
    supports_graduation_audit: true,
    grade_release_policy: "registrar_release",
    guardian_visibility_policy: "not_applicable",
    created_at: now,
    updated_at: now,
  },
  scale: {
    id: "scale-letter",
    tenant_id: "tenant-grading",
    name: "Letter Scale",
    scale_type: "letter_grade",
    applies_to_record_type: "transcript",
    narrative_required: false,
    status: "active",
    created_at: now,
    updated_at: now,
  },
  band: {
    id: "band-a",
    tenant_id: "tenant-grading",
    scale_id: "scale-letter",
    label: "A",
    minimum_value: 90,
    maximum_value: 100,
    grade_points: 4,
    is_passing: true,
    is_completion: true,
    official_record_value: "A",
    sequence: 1,
  },
  ruleSet: {
    id: "ruleset-bibl-101",
    tenant_id: "tenant-grading",
    course_id: "course-bibl-101",
    section_id: null,
    evaluation_type: "letter_grade",
    scale_id: "scale-letter",
    record_type: "transcript",
    gpa_policy: "included",
    credit_policy: "attempted_and_earned",
    clock_hour_policy: "not_applicable",
    competency_policy: "not_applicable",
    narrative_policy: "not_required",
    posting_policy: "registrar_posting",
    lms_grade_return_policy: "manual_entry_only",
    status: "active",
    created_at: now,
    updated_at: now,
  },
  officialRecordRule: {
    id: "record-transcript",
    tenant_id: "tenant-grading",
    record_type: "transcript",
    applies_to_institution_mode: "college",
    posting_authority: "registrar",
    release_policy: "registrar_release",
    included_in_transcript: true,
    included_in_progress_report: false,
    included_in_completion_record: false,
    included_in_promotion: false,
    included_in_graduation_audit: true,
    status: "active",
  },
  standingRule: {
    id: "standing-good",
    tenant_id: "tenant-grading",
    name: "Good Standing",
    standing_type: "good_standing",
    applies_to_institution_mode: "college",
    minimum_gpa: 2,
    minimum_credits_earned: 12,
    minimum_clock_hours: null,
    required_competencies: JSON.stringify([]),
    required_completion_records: JSON.stringify([]),
    promotion_criteria: null,
    graduation_criteria: null,
    status: "active",
  },
};

test("maps grading records rows into a valid domain configuration", () => {
  const config = mapGradingRecordsRows({
    institutionProfile: rows.institutionProfile,
    gradingProfile: rows.gradingProfile,
    scales: [rows.scale],
    scaleBands: [rows.band],
    ruleSets: [rows.ruleSet],
    officialRecordRules: [rows.officialRecordRule],
    standingRules: [rows.standingRule],
  });

  assert.equal(config.institutionProfile.tenantId, "tenant-grading");
  assert.equal(config.gradingProfile.defaultOfficialRecordType, "transcript");
  assert.equal(config.scales[0].scaleType, "letter_grade");
  assert.equal(config.scaleBands[0].gradePoints, 4);
  assert.equal(config.ruleSets[0].gpaPolicy, "included");
  assert.equal(config.officialRecordRules[0].includedInGraduationAudit, true);
  assert.equal(config.standingRules[0].minimumCreditsEarned, 12);
  assert.deepEqual(validateGradingRecordsConfiguration(config), []);
});

test("fetchGradingRecordsConfiguration reads tenant-scoped grading rows", async () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const repository = new AcademyGradingRecordsRepository({
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes("academy_institution_profiles")) return { rowCount: 1, rows: [rows.institutionProfile] };
      if (sql.includes("academy_grading_profiles")) return { rowCount: 1, rows: [rows.gradingProfile] };
      if (sql.includes("academy_evaluation_scales")) return { rowCount: 1, rows: [rows.scale] };
      if (sql.includes("academy_evaluation_scale_bands")) return { rowCount: 1, rows: [rows.band] };
      if (sql.includes("academy_evaluation_rule_sets")) return { rowCount: 1, rows: [rows.ruleSet] };
      if (sql.includes("academy_official_record_rules")) return { rowCount: 1, rows: [rows.officialRecordRule] };
      if (sql.includes("academy_academic_standing_rules")) return { rowCount: 1, rows: [rows.standingRule] };
      return { rowCount: 0, rows: [] };
    },
  });

  const config = await repository.fetchGradingRecordsConfiguration("tenant-grading");

  assert.equal(config.gradingProfile.tenantId, "tenant-grading");
  assert.ok(calls.every((call) => call.sql.match(/tenant_id = \$1/i) || call.sql.includes("academy_institution_profiles")));
  assert.ok(calls.every((call) => call.params[0] === "tenant-grading"));
});

test("fetchGradingRecordsConfiguration reports missing tenant grading profiles", async () => {
  const repository = new AcademyGradingRecordsRepository({
    query: async (sql: string) => {
      if (sql.includes("academy_institution_profiles")) return { rowCount: 1, rows: [rows.institutionProfile] };
      return { rowCount: 0, rows: [] };
    },
  });

  await assert.rejects(
    () => repository.fetchGradingRecordsConfiguration("missing-grading"),
    /Grading records profile for tenant missing-grading was not found./,
  );
});
