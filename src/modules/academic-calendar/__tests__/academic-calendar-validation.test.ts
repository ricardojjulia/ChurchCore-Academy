import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { AcademicCalendarConfiguration, validateAcademicCalendarConfiguration } from "@/modules/academic-calendar/validation";

function baseConfig(overrides: Partial<AcademicCalendarConfiguration> = {}): AcademicCalendarConfiguration {
  const profile = createInstitutionProfileDefaults({
    tenantId: "tenant-calendar",
    institutionName: "Calendar Academy",
    legalName: "Calendar Academy",
    primaryMode: "college",
    now: "2026-06-01T00:00:00.000Z",
  });

  return {
    institutionProfile: profile,
    calendarProfile: {
      tenantId: "tenant-calendar",
      calendarSystem: "academic_year",
      defaultTermStructure: "semester",
      timezone: "America/New_York",
      weekStartsOn: "monday",
      usesInstructionalDays: true,
      usesEnrollmentWindows: true,
      usesGradingWindows: true,
      usesTranscriptPeriods: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    academicYears: [
      {
        id: "year-2026",
        tenantId: "tenant-calendar",
        name: "2026-2027 Academic Year",
        code: "AY2026",
        startsOn: "2026-08-01",
        endsOn: "2027-05-31",
        status: "active",
        calendarSystem: "academic_year",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    periods: [
      {
        id: "term-fall",
        tenantId: "tenant-calendar",
        academicYearId: "year-2026",
        name: "Fall Term",
        code: "FALL",
        periodType: "term",
        startsOn: "2026-08-15",
        endsOn: "2026-12-15",
        sequence: 1,
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    enrollmentWindows: [
      {
        id: "registration-fall",
        tenantId: "tenant-calendar",
        academicPeriodId: "term-fall",
        windowType: "registration",
        opensAt: "2026-07-01T00:00:00.000Z",
        closesAt: "2026-08-20T23:59:59.000Z",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    gradingWindows: [
      {
        id: "grading-fall",
        tenantId: "tenant-calendar",
        academicPeriodId: "term-fall",
        opensAt: "2026-12-16T00:00:00.000Z",
        closesAt: "2026-12-22T23:59:59.000Z",
        gradePostingPolicy: "registrar_posting",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    transcriptPeriods: [
      {
        id: "transcript-fall",
        tenantId: "tenant-calendar",
        academicPeriodId: "term-fall",
        recordType: "transcript",
        postingOpensAt: "2026-12-23T00:00:00.000Z",
        postingClosesAt: "2027-01-10T23:59:59.000Z",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    subdivisions: [],
    ...overrides,
  };
}

test("accepts a college academic year with term, registration, grading, and transcript periods", () => {
  assert.deepEqual(validateAcademicCalendarConfiguration(baseConfig()), []);
});

test("accepts a university quarter calendar scoped to a school subdivision", () => {
  const profile = createInstitutionProfileDefaults({
    tenantId: "tenant-university",
    institutionName: "Covenant University",
    legalName: "Covenant University",
    primaryMode: "university",
    now: "2026-06-01T00:00:00.000Z",
  });

  const config = baseConfig({
    institutionProfile: profile,
    calendarProfile: {
      ...baseConfig().calendarProfile,
      tenantId: "tenant-university",
      defaultTermStructure: "quarter",
    },
    academicYears: [
      {
        ...baseConfig().academicYears[0],
        tenantId: "tenant-university",
        subdivisionId: "school-ministry",
      },
    ],
    periods: [
      {
        ...baseConfig().periods[0],
        id: "winter-quarter",
        tenantId: "tenant-university",
        name: "Winter Quarter",
        code: "WQ",
        startsOn: "2027-01-05",
        endsOn: "2027-03-20",
        subdivisionId: "school-ministry",
      },
    ],
    enrollmentWindows: [
      {
        ...baseConfig().enrollmentWindows[0],
        tenantId: "tenant-university",
        academicPeriodId: "winter-quarter",
      },
    ],
    gradingWindows: [
      {
        ...baseConfig().gradingWindows[0],
        tenantId: "tenant-university",
        academicPeriodId: "winter-quarter",
        opensAt: "2027-03-21T00:00:00.000Z",
        closesAt: "2027-03-28T23:59:59.000Z",
      },
    ],
    transcriptPeriods: [
      {
        ...baseConfig().transcriptPeriods[0],
        tenantId: "tenant-university",
        academicPeriodId: "winter-quarter",
        postingOpensAt: "2027-03-29T00:00:00.000Z",
        postingClosesAt: "2027-04-10T23:59:59.000Z",
      },
    ],
    subdivisions: [
      {
        id: "school-ministry",
        tenantId: "tenant-university",
        name: "School of Ministry",
        code: "MIN",
        subdivisionType: "school",
        institutionMode: "university",
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(validateAcademicCalendarConfiguration(config), []);
});

test("accepts Bible school rolling enrollment modules with completion records and cohorts", () => {
  const profile = createInstitutionProfileDefaults({
    tenantId: "tenant-bible",
    institutionName: "Bible Training Institute",
    legalName: "Bible Training Institute",
    primaryMode: "bible_school",
    now: "2026-06-01T00:00:00.000Z",
  });

  const config = baseConfig({
    institutionProfile: profile,
    calendarProfile: {
      ...baseConfig().calendarProfile,
      tenantId: "tenant-bible",
      calendarSystem: "rolling_enrollment",
      defaultTermStructure: "module",
      usesTranscriptPeriods: true,
    },
    academicYears: [
      {
        ...baseConfig().academicYears[0],
        id: "bible-reporting-year",
        tenantId: "tenant-bible",
        calendarSystem: "rolling_enrollment",
      },
    ],
    periods: [
      {
        ...baseConfig().periods[0],
        id: "module-acts",
        tenantId: "tenant-bible",
        academicYearId: "bible-reporting-year",
        periodType: "module",
        name: "Acts Ministry Module",
      },
    ],
    enrollmentWindows: [
      {
        ...baseConfig().enrollmentWindows[0],
        id: "rolling-application",
        tenantId: "tenant-bible",
        academicPeriodId: "module-acts",
        windowType: "application",
        closesAt: null,
      },
    ],
    gradingWindows: [],
    transcriptPeriods: [
      {
        ...baseConfig().transcriptPeriods[0],
        id: "completion-acts",
        tenantId: "tenant-bible",
        academicPeriodId: "module-acts",
        recordType: "completion_record",
      },
    ],
    subdivisions: [
      {
        id: "cohort-ministry",
        tenantId: "tenant-bible",
        name: "Ministry Track Cohort",
        code: "MIN-COHORT",
        subdivisionType: "cohort",
        institutionMode: "bible_school",
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(validateAcademicCalendarConfiguration(config), []);
});

test("requires grade bands for children's school grade-level calendars", () => {
  const profile = createInstitutionProfileDefaults({
    tenantId: "tenant-child",
    institutionName: "Grace Children's School",
    legalName: "Grace Children's School",
    primaryMode: "childrens_school",
    now: "2026-06-01T00:00:00.000Z",
  });

  const config = baseConfig({
    institutionProfile: profile,
    calendarProfile: {
      ...baseConfig().calendarProfile,
      tenantId: "tenant-child",
      calendarSystem: "school_year",
      defaultTermStructure: "trimester",
      usesTranscriptPeriods: false,
    },
    academicYears: [{ ...baseConfig().academicYears[0], tenantId: "tenant-child", calendarSystem: "school_year" }],
    periods: [{ ...baseConfig().periods[0], tenantId: "tenant-child", periodType: "term" }],
    enrollmentWindows: [],
    gradingWindows: [],
    transcriptPeriods: [],
    subdivisions: [],
  });

  assert.deepEqual(validateAcademicCalendarConfiguration(config), [
    "Children's school calendars with grade levels must include at least one grade band subdivision.",
  ]);

  assert.deepEqual(
    validateAcademicCalendarConfiguration({
      ...config,
      subdivisions: [
        {
          id: "grade-band-k2",
          tenantId: "tenant-child",
          name: "K-2",
          code: "K2",
          subdivisionType: "grade_band",
          institutionMode: "childrens_school",
          status: "active",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    }),
    [],
  );
});

test("rejects overlapping active academic years for the same tenant and subdivision only", () => {
  const profile = createInstitutionProfileDefaults({
    tenantId: "tenant-calendar",
    institutionName: "Calendar Academy",
    legalName: "Calendar Academy",
    primaryMode: "bible_school",
    now: "2026-06-01T00:00:00.000Z",
  });
  const config = baseConfig({
    institutionProfile: profile,
    academicYears: [
      { ...baseConfig().academicYears[0], id: "year-a", subdivisionId: "school-a" },
      {
        ...baseConfig().academicYears[0],
        id: "year-b",
        subdivisionId: "school-a",
        startsOn: "2027-01-01",
        endsOn: "2027-12-31",
      },
      {
        ...baseConfig().academicYears[0],
        id: "year-c",
        subdivisionId: "school-b",
        startsOn: "2027-01-01",
        endsOn: "2027-12-31",
      },
    ],
    periods: [],
    enrollmentWindows: [],
    gradingWindows: [],
    transcriptPeriods: [],
  });

  assert.deepEqual(validateAcademicCalendarConfiguration(config), [
    "Active academic years year-a and year-b overlap for the same tenant and subdivision.",
  ]);
});

test("rejects invalid period, window, and transcript combinations", () => {
  const config = baseConfig({
    periods: [
      {
        ...baseConfig().periods[0],
        id: "term-outside",
        startsOn: "2026-07-01",
        endsOn: "2026-12-15",
      },
      {
        ...baseConfig().periods[0],
        id: "break-fall",
        periodType: "break",
      },
    ],
    enrollmentWindows: [
      {
        ...baseConfig().enrollmentWindows[0],
        id: "invalid-registration",
        academicPeriodId: "break-fall",
        opensAt: "2026-08-25T00:00:00.000Z",
        closesAt: "2026-08-20T00:00:00.000Z",
      },
    ],
    gradingWindows: [
      {
        ...baseConfig().gradingWindows[0],
        academicPeriodId: "term-outside",
        opensAt: "2026-12-01T00:00:00.000Z",
        closesAt: "2026-11-01T00:00:00.000Z",
      },
    ],
    transcriptPeriods: [
      {
        ...baseConfig().transcriptPeriods[0],
        academicPeriodId: "term-outside",
        postingOpensAt: "2027-01-10T00:00:00.000Z",
        postingClosesAt: "2027-01-01T00:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(validateAcademicCalendarConfiguration(config), [
    "Academic period term-outside must fall inside its academic year.",
    "Enrollment window invalid-registration must close after it opens.",
    "Registration and add/drop windows cannot target break periods.",
    "Grading window grading-fall must close after it opens.",
    "Transcript period transcript-fall must close after it opens.",
  ]);
});

test("requires transcript periods for transcript-bearing institutions", () => {
  const config = baseConfig({ transcriptPeriods: [] });

  assert.deepEqual(validateAcademicCalendarConfiguration(config), [
    "Transcript-bearing institutions must include at least one transcript period.",
  ]);
});

test("requires mode-scoped subdivision branches for mixed institutions", () => {
  const profile = createInstitutionProfileDefaults({
    tenantId: "tenant-mixed",
    institutionName: "Kingdom Learning Institute",
    legalName: "Kingdom Learning Institute",
    primaryMode: "bible_school",
    supportedModes: ["childrens_school", "bible_school"],
    now: "2026-06-01T00:00:00.000Z",
  });

  const config = baseConfig({
    institutionProfile: profile,
    calendarProfile: { ...baseConfig().calendarProfile, tenantId: "tenant-mixed" },
    academicYears: [{ ...baseConfig().academicYears[0], tenantId: "tenant-mixed" }],
    periods: [{ ...baseConfig().periods[0], tenantId: "tenant-mixed" }],
    enrollmentWindows: [],
    gradingWindows: [],
    transcriptPeriods: [],
    subdivisions: [
      {
        id: "grade-band-k2",
        tenantId: "tenant-mixed",
        name: "K-2",
        code: "K2",
        subdivisionType: "grade_band",
        institutionMode: "childrens_school",
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "bible-school-branch",
        tenantId: "tenant-mixed",
        name: "Bible School Branch",
        code: "BIBLE",
        subdivisionType: "school",
        institutionMode: "bible_school",
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(validateAcademicCalendarConfiguration(config), [
    "Mixed institutions must include an active subdivision branch for childrens_school mode.",
  ]);
});
