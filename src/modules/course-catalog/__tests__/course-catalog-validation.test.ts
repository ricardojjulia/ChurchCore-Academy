import assert from "node:assert/strict";
import test from "node:test";
import { AcademicPeriod, AcademicYear, InstitutionSubdivision } from "@/modules/academic-calendar/types";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { CourseCatalogConfiguration, validateCourseCatalogConfiguration } from "@/modules/course-catalog/validation";

const now = "2026-06-02T00:00:00.000Z";

function baseAcademicYear(tenantId: string): AcademicYear {
  return {
    id: "year-2026",
    tenantId,
    name: "2026-2027 Academic Year",
    code: "AY2026",
    startsOn: "2026-08-01",
    endsOn: "2027-05-31",
    status: "active",
    calendarSystem: "academic_year",
    createdAt: now,
    updatedAt: now,
  };
}

function baseAcademicPeriod(tenantId: string): AcademicPeriod {
  return {
    id: "term-fall",
    tenantId,
    academicYearId: "year-2026",
    name: "Fall Term",
    code: "FALL",
    periodType: "term",
    startsOn: "2026-08-15",
    endsOn: "2026-12-15",
    sequence: 1,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function schoolSubdivision(tenantId: string): InstitutionSubdivision {
  return {
    id: "school-ministry",
    tenantId,
    name: "School of Ministry",
    code: "MIN",
    subdivisionType: "school",
    institutionMode: "college",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function gradeBandSubdivision(tenantId: string): InstitutionSubdivision {
  return {
    id: "grade-band-k5",
    tenantId,
    name: "K-5",
    code: "K5",
    subdivisionType: "grade_band",
    institutionMode: "childrens_school",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function baseConfig(overrides: Partial<CourseCatalogConfiguration> = {}): CourseCatalogConfiguration {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-course",
    institutionName: "Course Academy",
    legalName: "Course Academy",
    primaryMode: "college",
    now,
  });

  return {
    institutionProfile,
    catalogProfile: {
      tenantId: "tenant-course",
      defaultCourseRecordType: "transcript",
      defaultDurationUnit: "credit_hour",
      supportsCredits: true,
      supportsClockHours: false,
      supportsCompetencies: false,
      supportsNarrativeEvaluation: false,
      supportsGradeLevels: false,
      supportsLmsMapping: true,
      createdAt: now,
      updatedAt: now,
    },
    academicYears: [baseAcademicYear("tenant-course")],
    academicPeriods: [baseAcademicPeriod("tenant-course")],
    subdivisions: [schoolSubdivision("tenant-course")],
    courses: [
      {
        id: "course-bibl-101",
        tenantId: "tenant-course",
        code: "BIBL-101",
        title: "Biblical Interpretation",
        description: "Foundations for faithful interpretation of Scripture.",
        courseType: "general_education",
        courseLevel: "undergraduate",
        recordType: "transcript",
        defaultDuration: {
          durationUnit: "credit_hour",
          durationValue: 3,
          creditHours: 3,
        },
        defaultCredits: 3,
        owningSubdivisionId: "school-ministry",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    sections: [
      {
        id: "section-bibl-101-fall",
        tenantId: "tenant-course",
        courseId: "course-bibl-101",
        academicYearId: "year-2026",
        academicPeriodId: "term-fall",
        subdivisionId: "school-ministry",
        sectionCode: "BIBL-101-A",
        deliveryMode: "in_person",
        schedulePattern: "MWF 9:00 AM",
        capacity: 30,
        status: "open",
        primaryInstructorRole: "professor",
        primaryInstructorId: "faculty-1",
        assistantInstructorIds: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    prerequisites: [],
    lmsMappings: [],
    ...overrides,
  };
}

test("accepts a college credit course and scheduled section", () => {
  assert.deepEqual(validateCourseCatalogConfiguration(baseConfig()), []);
});

test("accepts a Bible school clock-hour completion module without LMS mapping", () => {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-bible",
    institutionName: "Bible Training Institute",
    legalName: "Bible Training Institute",
    primaryMode: "bible_school",
    now,
  });

  const year = { ...baseAcademicYear("tenant-bible"), calendarSystem: "rolling_enrollment" as const };
  const period = { ...baseAcademicPeriod("tenant-bible"), id: "module-acts", tenantId: "tenant-bible", periodType: "module" as const };
  const cohort: InstitutionSubdivision = {
    id: "cohort-ministry",
    tenantId: "tenant-bible",
    name: "Ministry Training Cohort",
    code: "MIN2026",
    subdivisionType: "cohort",
    institutionMode: "bible_school",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const config = baseConfig({
    institutionProfile,
    catalogProfile: {
      ...baseConfig().catalogProfile,
      tenantId: "tenant-bible",
      defaultCourseRecordType: "completion_record",
      defaultDurationUnit: "clock_hour",
      supportsCredits: false,
      supportsClockHours: true,
      supportsLmsMapping: false,
    },
    academicYears: [year],
    academicPeriods: [period],
    subdivisions: [cohort],
    courses: [
      {
        ...baseConfig().courses[0],
        id: "course-acts",
        tenantId: "tenant-bible",
        code: "ACTS-MIN",
        title: "Acts Ministry Module",
        courseType: "bible_course",
        courseLevel: "certificate",
        recordType: "completion_record",
        defaultDuration: {
          durationUnit: "clock_hour",
          durationValue: 24,
          clockHours: 24,
        },
        defaultCredits: undefined,
        defaultClockHours: 24,
        owningSubdivisionId: "cohort-ministry",
      },
    ],
    sections: [
      {
        ...baseConfig().sections[0],
        id: "section-acts",
        tenantId: "tenant-bible",
        courseId: "course-acts",
        academicYearId: "year-2026",
        academicPeriodId: "module-acts",
        subdivisionId: "cohort-ministry",
        sectionCode: "ACTS-MIN-1",
        deliveryMode: "hybrid",
        status: "open",
        primaryInstructorRole: "instructor",
      },
    ],
  });

  assert.deepEqual(validateCourseCatalogConfiguration(config), []);
});

test("accepts a children's school class with grade-band context and progress records", () => {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-child",
    institutionName: "Grace Children's School",
    legalName: "Grace Children's School",
    primaryMode: "childrens_school",
    now,
  });

  const config = baseConfig({
    institutionProfile,
    catalogProfile: {
      ...baseConfig().catalogProfile,
      tenantId: "tenant-child",
      defaultCourseRecordType: "progress_record",
      defaultDurationUnit: "week",
      supportsCredits: false,
      supportsClockHours: false,
      supportsNarrativeEvaluation: true,
      supportsGradeLevels: true,
      supportsLmsMapping: false,
    },
    academicYears: [baseAcademicYear("tenant-child")],
    academicPeriods: [baseAcademicPeriod("tenant-child")],
    subdivisions: [gradeBandSubdivision("tenant-child")],
    courses: [
      {
        ...baseConfig().courses[0],
        id: "course-reading",
        tenantId: "tenant-child",
        code: "READ-K5",
        title: "Reading Foundations",
        courseType: "children_class",
        courseLevel: "children",
        recordType: "progress_record",
        defaultDuration: {
          durationUnit: "week",
          durationValue: 16,
        },
        defaultCredits: undefined,
        owningSubdivisionId: undefined,
        gradeBandSubdivisionId: "grade-band-k5",
      },
    ],
    sections: [
      {
        ...baseConfig().sections[0],
        id: "section-reading",
        tenantId: "tenant-child",
        courseId: "course-reading",
        subdivisionId: "grade-band-k5",
        sectionCode: "READ-K5-A",
        primaryInstructorRole: "teacher",
      },
    ],
  });

  assert.deepEqual(validateCourseCatalogConfiguration(config), []);
});

test("accepts ministry practicum and elective course models", () => {
  const practicum = {
    ...baseConfig().courses[0],
    id: "course-practicum",
    code: "MIN-390",
    title: "Supervised Ministry Practicum",
    courseType: "ministry_practicum" as const,
    courseLevel: "undergraduate" as const,
    defaultDuration: {
      durationUnit: "clock_hour" as const,
      durationValue: 45,
      clockHours: 45,
    },
    defaultCredits: undefined,
    defaultClockHours: 45,
  };
  const elective = {
    ...baseConfig().courses[0],
    id: "course-elective",
    code: "THEO-250",
    title: "Theology Elective",
    courseType: "elective" as const,
    courseLevel: "undergraduate" as const,
    defaultDuration: {
      durationUnit: "credit_hour" as const,
      durationValue: 3,
      creditHours: 3,
    },
    defaultCredits: 3,
  };
  const config = baseConfig({
    catalogProfile: {
      ...baseConfig().catalogProfile,
      supportsClockHours: true,
    },
    courses: [practicum, elective],
    sections: [
      {
        ...baseConfig().sections[0],
        id: "section-practicum",
        courseId: "course-practicum",
        sectionCode: "MIN-390-A",
        deliveryMode: "field_practicum",
      },
      {
        ...baseConfig().sections[0],
        id: "section-elective",
        courseId: "course-elective",
        sectionCode: "THEO-250-A",
        deliveryMode: "hybrid",
      },
    ],
  });

  assert.deepEqual(validateCourseCatalogConfiguration(config), []);
});

test("rejects transcript courses without credit or clock-hour measures", () => {
  const config = baseConfig({
    courses: [
      {
        ...baseConfig().courses[0],
        defaultCredits: undefined,
        defaultClockHours: undefined,
        defaultDuration: {
          durationUnit: "custom",
          durationValue: 1,
        },
      },
    ],
  });

  assert.deepEqual(validateCourseCatalogConfiguration(config), ["Transcript course course-bibl-101 must include credits or clock hours."]);
});

test("rejects children's school classes without grade-band context", () => {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-child",
    institutionName: "Grace Children's School",
    legalName: "Grace Children's School",
    primaryMode: "childrens_school",
    now,
  });

  const config = baseConfig({
    institutionProfile,
    catalogProfile: {
      ...baseConfig().catalogProfile,
      tenantId: "tenant-child",
      defaultCourseRecordType: "progress_record",
      supportsCredits: false,
      supportsGradeLevels: true,
    },
    academicYears: [baseAcademicYear("tenant-child")],
    academicPeriods: [baseAcademicPeriod("tenant-child")],
    subdivisions: [],
    courses: [
      {
        ...baseConfig().courses[0],
        tenantId: "tenant-child",
        courseType: "children_class",
        courseLevel: "children",
        recordType: "progress_record",
        owningSubdivisionId: undefined,
        gradeBandSubdivisionId: undefined,
      },
    ],
    sections: [],
  });

  assert.deepEqual(validateCourseCatalogConfiguration(config), ["Children's school course course-bibl-101 must reference a grade band subdivision."]);
});

test("rejects cross-tenant course section references before future persistence work", () => {
  const config = baseConfig({
    academicPeriods: [{ ...baseAcademicPeriod("other-tenant"), id: "foreign-term" }],
    sections: [
      {
        ...baseConfig().sections[0],
        academicPeriodId: "foreign-term",
      },
    ],
  });

  assert.deepEqual(validateCourseCatalogConfiguration(config), [
    "Academic period foreign-term tenant must match the institution tenant.",
    "Section section-bibl-101-fall academic period must belong to the same tenant.",
  ]);
});

test("rejects circular prerequisite chains", () => {
  const config = baseConfig({
    courses: [
      baseConfig().courses[0],
      {
        ...baseConfig().courses[0],
        id: "course-bibl-201",
        code: "BIBL-201",
        title: "Advanced Biblical Interpretation",
      },
    ],
    prerequisites: [
      {
        id: "prereq-101",
        tenantId: "tenant-course",
        courseId: "course-bibl-101",
        requiredCourseId: "course-bibl-201",
        requirementType: "required_before_registration",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "prereq-201",
        tenantId: "tenant-course",
        courseId: "course-bibl-201",
        requiredCourseId: "course-bibl-101",
        requirementType: "required_before_registration",
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  assert.deepEqual(validateCourseCatalogConfiguration(config), ["Course prerequisite cycle detected for course-bibl-101."]);
});

test("rejects LMS grade-return mapping before the grading contract exists", () => {
  const config = baseConfig({
    lmsMappings: [
      {
        id: "mapping-bibl-101",
        tenantId: "tenant-course",
        courseId: "course-bibl-101",
        sectionId: "section-bibl-101-fall",
        provider: "moodle",
        mappingStatus: "mapped",
        externalCourseKey: "M-101",
        externalSectionKey: "M-101-A",
        syncPolicy: "grade_return",
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  assert.deepEqual(validateCourseCatalogConfiguration(config), ["LMS mapping mapping-bibl-101 cannot enable grade return until the grading contract exists."]);
});
