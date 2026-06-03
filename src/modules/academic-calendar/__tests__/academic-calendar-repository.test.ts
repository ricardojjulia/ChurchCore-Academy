import assert from "node:assert/strict";
import test from "node:test";
import { AcademyCalendarRepository, mapAcademicCalendarRows } from "@/modules/academic-calendar/postgres-repository";
import { validateAcademicCalendarConfiguration } from "@/modules/academic-calendar/validation";

const rows = {
  institutionProfile: {
    tenant_id: "tenant-calendar",
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
    created_at: new Date("2026-06-01T00:00:00.000Z"),
    updated_at: new Date("2026-06-01T00:00:00.000Z"),
  },
  calendarProfile: {
    tenant_id: "tenant-calendar",
    calendar_system: "academic_year",
    default_term_structure: "semester",
    timezone: "America/New_York",
    week_starts_on: "monday",
    uses_instructional_days: true,
    uses_enrollment_windows: true,
    uses_grading_windows: true,
    uses_transcript_periods: true,
    created_at: new Date("2026-06-01T00:00:00.000Z"),
    updated_at: new Date("2026-06-01T00:00:00.000Z"),
  },
  academicYear: {
    id: "year-2026",
    tenant_id: "tenant-calendar",
    name: "2026-2027 Academic Year",
    code: "AY2026",
    starts_on: "2026-08-01",
    ends_on: "2027-05-31",
    status: "active",
    calendar_system: "academic_year",
    subdivision_id: null,
    created_at: new Date("2026-06-01T00:00:00.000Z"),
    updated_at: new Date("2026-06-01T00:00:00.000Z"),
  },
  period: {
    id: "term-fall",
    tenant_id: "tenant-calendar",
    academic_year_id: "year-2026",
    parent_period_id: null,
    subdivision_id: null,
    name: "Fall Term",
    code: "FALL",
    period_type: "term",
    starts_on: "2026-08-15",
    ends_on: "2026-12-15",
    sequence: 1,
    status: "active",
    created_at: new Date("2026-06-01T00:00:00.000Z"),
    updated_at: new Date("2026-06-01T00:00:00.000Z"),
  },
  enrollmentWindow: {
    id: "registration-fall",
    tenant_id: "tenant-calendar",
    academic_period_id: "term-fall",
    window_type: "registration",
    opens_at: new Date("2026-07-01T00:00:00.000Z"),
    closes_at: new Date("2026-08-20T23:59:59.000Z"),
    applies_to_subdivision_id: null,
    created_at: new Date("2026-06-01T00:00:00.000Z"),
    updated_at: new Date("2026-06-01T00:00:00.000Z"),
  },
  gradingWindow: {
    id: "grading-fall",
    tenant_id: "tenant-calendar",
    academic_period_id: "term-fall",
    opens_at: new Date("2026-12-16T00:00:00.000Z"),
    closes_at: new Date("2026-12-22T23:59:59.000Z"),
    grade_posting_policy: "registrar_posting",
    created_at: new Date("2026-06-01T00:00:00.000Z"),
    updated_at: new Date("2026-06-01T00:00:00.000Z"),
  },
  transcriptPeriod: {
    id: "transcript-fall",
    tenant_id: "tenant-calendar",
    academic_period_id: "term-fall",
    record_type: "transcript",
    posting_opens_at: new Date("2026-12-23T00:00:00.000Z"),
    posting_closes_at: new Date("2027-01-10T23:59:59.000Z"),
    created_at: new Date("2026-06-01T00:00:00.000Z"),
    updated_at: new Date("2026-06-01T00:00:00.000Z"),
  },
  subdivision: {
    id: "dept-biblical-studies",
    tenant_id: "tenant-calendar",
    parent_subdivision_id: null,
    name: "Biblical Studies",
    code: "BIB",
    subdivision_type: "department",
    institution_mode: "college",
    status: "active",
    created_at: new Date("2026-06-01T00:00:00.000Z"),
    updated_at: new Date("2026-06-01T00:00:00.000Z"),
  },
};

test("maps academic calendar rows into a valid domain configuration", () => {
  const config = mapAcademicCalendarRows({
    institutionProfile: rows.institutionProfile,
    calendarProfile: rows.calendarProfile,
    academicYears: [rows.academicYear],
    periods: [rows.period],
    enrollmentWindows: [rows.enrollmentWindow],
    gradingWindows: [rows.gradingWindow],
    transcriptPeriods: [rows.transcriptPeriod],
    subdivisions: [rows.subdivision],
  });

  assert.equal(config.institutionProfile.tenantId, "tenant-calendar");
  assert.equal(config.calendarProfile.defaultTermStructure, "semester");
  assert.equal(config.academicYears[0].id, "year-2026");
  assert.equal(config.periods[0].periodType, "term");
  assert.equal(config.enrollmentWindows[0].windowType, "registration");
  assert.equal(config.gradingWindows[0].gradePostingPolicy, "registrar_posting");
  assert.equal(config.transcriptPeriods[0].recordType, "transcript");
  assert.equal(config.subdivisions[0].subdivisionType, "department");
  assert.deepEqual(validateAcademicCalendarConfiguration(config), []);
});

test("fetchAcademicCalendarConfiguration reads tenant-scoped calendar rows", async () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const repository = new AcademyCalendarRepository({
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes("academy_institution_profiles")) return { rowCount: 1, rows: [rows.institutionProfile] };
      if (sql.includes("academy_calendar_profiles")) return { rowCount: 1, rows: [rows.calendarProfile] };
      if (sql.includes("academy_academic_years")) return { rowCount: 1, rows: [rows.academicYear] };
      if (sql.includes("academy_academic_periods")) return { rowCount: 1, rows: [rows.period] };
      if (sql.includes("academy_enrollment_windows")) return { rowCount: 1, rows: [rows.enrollmentWindow] };
      if (sql.includes("academy_grading_windows")) return { rowCount: 1, rows: [rows.gradingWindow] };
      if (sql.includes("academy_transcript_periods")) return { rowCount: 1, rows: [rows.transcriptPeriod] };
      if (sql.includes("academy_institution_subdivisions")) return { rowCount: 1, rows: [rows.subdivision] };
      return { rowCount: 0, rows: [] };
    },
  });

  const config = await repository.fetchAcademicCalendarConfiguration("tenant-calendar");

  assert.equal(config.calendarProfile.tenantId, "tenant-calendar");
  assert.ok(calls.every((call) => call.sql.match(/tenant_id = \$1/i) || call.sql.includes("academy_institution_profiles")));
  assert.ok(calls.every((call) => call.params[0] === "tenant-calendar"));
});

test("fetchAcademicCalendarConfiguration reports missing tenant calendar profiles", async () => {
  const repository = new AcademyCalendarRepository({
    query: async (sql: string) => {
      if (sql.includes("academy_institution_profiles")) return { rowCount: 1, rows: [rows.institutionProfile] };
      return { rowCount: 0, rows: [] };
    },
  });

  await assert.rejects(
    () => repository.fetchAcademicCalendarConfiguration("missing-calendar"),
    /Academic calendar profile for tenant missing-calendar was not found./,
  );
});
