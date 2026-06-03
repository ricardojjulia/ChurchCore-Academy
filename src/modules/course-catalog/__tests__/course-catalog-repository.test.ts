import assert from "node:assert/strict";
import test from "node:test";
import { AcademyCourseCatalogRepository, mapCourseCatalogRows } from "@/modules/course-catalog/postgres-repository";
import { validateCourseCatalogConfiguration } from "@/modules/course-catalog/validation";

const now = new Date("2026-06-02T00:00:00.000Z");

const rows = {
  institutionProfile: {
    tenant_id: "tenant-course",
    institution_name: "Repository Academy",
    legal_name: "Repository Academy Inc.",
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
  catalogProfile: {
    tenant_id: "tenant-course",
    default_course_record_type: "transcript",
    default_duration_unit: "credit_hour",
    supports_credits: true,
    supports_clock_hours: false,
    supports_competencies: false,
    supports_narrative_evaluation: false,
    supports_grade_levels: false,
    supports_lms_mapping: true,
    created_at: now,
    updated_at: now,
  },
  academicYear: {
    id: "year-2026",
    tenant_id: "tenant-course",
    name: "2026-2027 Academic Year",
    code: "AY2026",
    starts_on: "2026-08-01",
    ends_on: "2027-05-31",
    status: "active",
    calendar_system: "academic_year",
    subdivision_id: "school-ministry",
    created_at: now,
    updated_at: now,
  },
  academicPeriod: {
    id: "term-fall",
    tenant_id: "tenant-course",
    academic_year_id: "year-2026",
    parent_period_id: null,
    subdivision_id: "school-ministry",
    name: "Fall Term",
    code: "FALL",
    period_type: "term",
    starts_on: "2026-08-15",
    ends_on: "2026-12-15",
    sequence: 1,
    status: "active",
    created_at: now,
    updated_at: now,
  },
  subdivision: {
    id: "school-ministry",
    tenant_id: "tenant-course",
    parent_subdivision_id: null,
    name: "School of Ministry",
    code: "MIN",
    subdivision_type: "school",
    institution_mode: "college",
    status: "active",
    created_at: now,
    updated_at: now,
  },
  course: {
    id: "course-bibl-101",
    tenant_id: "tenant-course",
    code: "BIBL-101",
    title: "Biblical Interpretation",
    description: "Foundations for faithful interpretation of Scripture.",
    course_type: "general_education",
    course_level: "undergraduate",
    record_type: "transcript",
    default_duration: JSON.stringify({ durationUnit: "credit_hour", durationValue: 3, creditHours: 3 }),
    default_credits: 3,
    default_clock_hours: null,
    default_competency_set_id: null,
    owning_subdivision_id: "school-ministry",
    grade_band_subdivision_id: null,
    status: "active",
    created_at: now,
    updated_at: now,
  },
  section: {
    id: "section-bibl-101-fall",
    tenant_id: "tenant-course",
    course_id: "course-bibl-101",
    academic_year_id: "year-2026",
    academic_period_id: "term-fall",
    subdivision_id: "school-ministry",
    section_code: "BIBL-101-A",
    title_override: null,
    delivery_mode: "in_person",
    schedule_pattern: "MWF 9:00 AM",
    capacity: 30,
    status: "open",
    primary_instructor_role: "professor",
    primary_instructor_id: "faculty-1",
    assistant_instructor_ids: JSON.stringify([]),
    lms_mapping_id: "mapping-bibl-101",
    created_at: now,
    updated_at: now,
  },
  prerequisite: {
    id: "prereq-bibl-101",
    tenant_id: "tenant-course",
    course_id: "course-bibl-101",
    required_course_id: "course-old-testament",
    requirement_type: "recommended",
    minimum_grade_rule_id: null,
    notes: "Recommended Old Testament survey background.",
    created_at: now,
    updated_at: now,
  },
  lmsMapping: {
    id: "mapping-bibl-101",
    tenant_id: "tenant-course",
    course_id: "course-bibl-101",
    section_id: "section-bibl-101-fall",
    provider: "moodle",
    mapping_status: "mapped",
    external_course_key: "M-BIBL-101",
    external_section_key: "M-BIBL-101-A",
    sync_policy: "provision_shell_only",
    last_reviewed_at: now,
    created_at: now,
    updated_at: now,
  },
};

test("maps course catalog rows into a valid domain configuration", () => {
  const config = mapCourseCatalogRows({
    institutionProfile: rows.institutionProfile,
    catalogProfile: rows.catalogProfile,
    academicYears: [rows.academicYear],
    academicPeriods: [rows.academicPeriod],
    subdivisions: [rows.subdivision],
    courses: [
      rows.course,
      {
        ...rows.course,
        id: "course-old-testament",
        code: "BIBL-100",
        title: "Old Testament Survey",
      },
    ],
    sections: [rows.section],
    prerequisites: [rows.prerequisite],
    lmsMappings: [rows.lmsMapping],
  });

  assert.equal(config.institutionProfile.tenantId, "tenant-course");
  assert.equal(config.catalogProfile.defaultDurationUnit, "credit_hour");
  assert.equal(config.courses[0].defaultDuration.durationUnit, "credit_hour");
  assert.equal(config.sections[0].sectionCode, "BIBL-101-A");
  assert.equal(config.prerequisites[0].requirementType, "recommended");
  assert.equal(config.lmsMappings[0].syncPolicy, "provision_shell_only");
  assert.deepEqual(validateCourseCatalogConfiguration(config), []);
});

test("fetchCourseCatalogConfiguration reads tenant-scoped course rows", async () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const repository = new AcademyCourseCatalogRepository({
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes("academy_institution_profiles")) return { rowCount: 1, rows: [rows.institutionProfile] };
      if (sql.includes("academy_course_catalog_profiles")) return { rowCount: 1, rows: [rows.catalogProfile] };
      if (sql.includes("academy_academic_years")) return { rowCount: 1, rows: [rows.academicYear] };
      if (sql.includes("academy_academic_periods")) return { rowCount: 1, rows: [rows.academicPeriod] };
      if (sql.includes("academy_institution_subdivisions")) return { rowCount: 1, rows: [rows.subdivision] };
      if (sql.includes("academy_courses")) return { rowCount: 1, rows: [rows.course] };
      if (sql.includes("academy_course_sections")) return { rowCount: 1, rows: [rows.section] };
      if (sql.includes("academy_course_prerequisites")) return { rowCount: 0, rows: [] };
      if (sql.includes("academy_course_lms_mappings")) return { rowCount: 1, rows: [rows.lmsMapping] };
      return { rowCount: 0, rows: [] };
    },
  });

  const config = await repository.fetchCourseCatalogConfiguration("tenant-course");

  assert.equal(config.catalogProfile.tenantId, "tenant-course");
  assert.ok(calls.every((call) => call.sql.match(/tenant_id = \$1/i) || call.sql.includes("academy_institution_profiles")));
  assert.ok(calls.every((call) => call.params[0] === "tenant-course"));
});

test("fetchCourseCatalogConfiguration reports missing tenant catalog profiles", async () => {
  const repository = new AcademyCourseCatalogRepository({
    query: async (sql: string) => {
      if (sql.includes("academy_institution_profiles")) return { rowCount: 1, rows: [rows.institutionProfile] };
      return { rowCount: 0, rows: [] };
    },
  });

  await assert.rejects(
    () => repository.fetchCourseCatalogConfiguration("missing-course-catalog"),
    /Course catalog profile for tenant missing-course-catalog was not found./,
  );
});
