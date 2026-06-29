import { AcademicPeriod, AcademicYear, InstitutionSubdivision } from "@/modules/academic-calendar/types";
import {
  Course,
  CourseCatalogConfiguration,
  CourseLmsMapping,
  CourseSection,
} from "@/modules/course-catalog/types";
import { validateCourseCatalogConfiguration } from "@/modules/course-catalog/validation";

export interface CourseReviewMetric {
  label: string;
  value: string;
  detail: string;
}

export interface CourseReviewItem {
  label: string;
  value: string;
}

export interface CourseCoverageReviewItem {
  label: string;
  count: number;
  detail: string;
}

export interface CourseReviewCourseItem {
  id: string;
  code: string;
  title: string;
  type: string;
  level: string;
  recordType: string;
  duration: string;
  status: string;
  subdivision: string;
  gradeBand: string;
}

export interface CourseReviewSectionItem {
  id: string;
  sectionCode: string;
  courseCode: string;
  courseTitle: string;
  status: string;
  deliveryMode: string;
  schedule: string;
  capacity: string;
  instructorRole: string;
  instructorStatus: string;
  academicYear: string;
  period: string;
  subdivision: string;
}

export interface CourseLmsMappingReviewItem {
  id: string;
  provider: string;
  status: string;
  policy: string;
  course: string;
  section: string;
  externalCourseKey: string;
  externalSectionKey: string;
}

export interface CourseCatalogReviewModel {
  summary: {
    tenantId: string;
    institutionName: string;
    defaultRecordType: string;
    defaultDurationUnit: string;
    lmsMapping: string;
    updatedAt: string;
  };
  metrics: CourseReviewMetric[];
  profile: CourseReviewItem[];
  courseCoverage: CourseCoverageReviewItem[];
  recordCoverage: CourseCoverageReviewItem[];
  courses: CourseReviewCourseItem[];
  sections: CourseReviewSectionItem[];
  lmsMappings: CourseLmsMappingReviewItem[];
  validation: string[];
}

const labelOverrides: Record<string, string> = {
  attendance_only: "Attendance only",
  bible_course: "Bible course",
  children_class: "Children's class",
  clock_hour: "Clock hour",
  completion_record: "Completion record",
  credit_hour: "Credit hour",
  field_practicum: "Field practicum",
  full_section_sync: "Full section sync",
  grade_return: "Grade return",
  in_person: "In person",
  ministry_practicum: "Ministry practicum",
  non_record: "Non-record",
  not_required: "Not required",
  online: "Online",
  progress_record: "Progress record",
  provision_shell_only: "Provision shell only",
  ready_to_provision: "Ready to provision",
  roster_sync: "Roster sync",
};

function titleize(value: string) {
  const override = labelOverrides[value];
  if (override) return override;

  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function booleanLabel(value: boolean) {
  return value ? "Yes" : "No";
}

function mapById<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return value === 1 ? singular : plural;
}

function subdivisionName(subdivisionsById: Map<string, InstitutionSubdivision>, subdivisionId?: string) {
  return subdivisionId ? subdivisionsById.get(subdivisionId)?.name ?? "Unknown subdivision" : "Institution-wide";
}

function periodName(periodsById: Map<string, AcademicPeriod>, periodId: string) {
  return periodsById.get(periodId)?.name ?? "Unknown period";
}

function academicYearName(yearsById: Map<string, AcademicYear>, academicYearId: string) {
  return yearsById.get(academicYearId)?.name ?? "Unknown academic year";
}

function courseLabel(coursesById: Map<string, Course>, courseId?: string) {
  if (!courseId) return "Not linked";
  const course = coursesById.get(courseId);
  return course ? `${course.code} - ${course.title}` : "Unknown course";
}

function sectionLabel(sectionsById: Map<string, CourseSection>, sectionId?: string) {
  if (!sectionId) return "Not linked";
  const section = sectionsById.get(sectionId);
  return section?.sectionCode ?? "Unknown section";
}

function lmsProviderLabel(provider: CourseLmsMapping["provider"]) {
  return provider === "none" ? "No LMS" : titleize(provider);
}

function durationLabel(course: Course) {
  const duration = course.defaultDuration;

  if (duration.durationUnit === "credit_hour") {
    const credits = course.defaultCredits ?? duration.creditHours ?? duration.durationValue;
    return `${credits} ${pluralize(credits, "credit")}`;
  }

  if (duration.durationUnit === "clock_hour") {
    const hours = course.defaultClockHours ?? duration.clockHours ?? duration.durationValue;
    return `${hours} clock ${pluralize(hours, "hour")}`;
  }

  return `${duration.durationValue} ${titleize(duration.durationUnit).toLowerCase()}${duration.durationValue === 1 ? "" : "s"}`;
}

function buildProfile(config: CourseCatalogConfiguration): CourseReviewItem[] {
  const profile = config.catalogProfile;

  return [
    { label: "Tenant", value: profile.tenantId },
    { label: "Default record type", value: titleize(profile.defaultCourseRecordType) },
    { label: "Default duration", value: titleize(profile.defaultDurationUnit) },
    { label: "Credits", value: booleanLabel(profile.supportsCredits) },
    { label: "Clock hours", value: booleanLabel(profile.supportsClockHours) },
    { label: "Competencies", value: booleanLabel(profile.supportsCompetencies) },
    { label: "Narrative evaluation", value: booleanLabel(profile.supportsNarrativeEvaluation) },
    { label: "Grade levels", value: booleanLabel(profile.supportsGradeLevels) },
    { label: "LMS mapping", value: booleanLabel(profile.supportsLmsMapping) },
  ];
}

function buildCoverage(items: string[], detail: string): CourseCoverageReviewItem[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const label = titleize(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, detail }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildCourseItems(config: CourseCatalogConfiguration, subdivisionsById: Map<string, InstitutionSubdivision>): CourseReviewCourseItem[] {
  return config.courses.map((course) => ({
    id: course.id,
    code: course.code,
    title: course.title,
    type: titleize(course.courseType),
    level: titleize(course.courseLevel),
    recordType: titleize(course.recordType),
    duration: durationLabel(course),
    status: titleize(course.status),
    subdivision: subdivisionName(subdivisionsById, course.owningSubdivisionId),
    gradeBand: subdivisionName(subdivisionsById, course.gradeBandSubdivisionId),
  }));
}

function buildSectionItems(
  config: CourseCatalogConfiguration,
  coursesById: Map<string, Course>,
  yearsById: Map<string, AcademicYear>,
  periodsById: Map<string, AcademicPeriod>,
  subdivisionsById: Map<string, InstitutionSubdivision>,
): CourseReviewSectionItem[] {
  return config.sections.map((section) => {
    const course = coursesById.get(section.courseId);
    const period = periodsById.get(section.academicPeriodId);

    return {
      id: section.id,
      sectionCode: section.sectionCode,
      courseCode: course?.code ?? "Unknown",
      courseTitle: section.titleOverride ?? course?.title ?? "Unknown course",
      status: titleize(section.status),
      deliveryMode: titleize(section.deliveryMode),
      schedule: section.schedulePattern ?? "Not configured",
      capacity: section.capacity ? String(section.capacity) : "Not configured",
      instructorRole: titleize(section.primaryInstructorRole),
      instructorStatus: section.primaryInstructorId ? "Assigned" : "Needs assignment",
      academicYear: period ? academicYearName(yearsById, period.academicYearId) : "Unknown year",
      period: periodName(periodsById, section.academicPeriodId),
      subdivision: subdivisionName(subdivisionsById, section.subdivisionId),
    };
  });
}

function buildLmsMappings(config: CourseCatalogConfiguration, coursesById: Map<string, Course>, sectionsById: Map<string, CourseSection>): CourseLmsMappingReviewItem[] {
  return config.lmsMappings.map((mapping) => ({
    id: mapping.id,
    provider: lmsProviderLabel(mapping.provider),
    status: titleize(mapping.mappingStatus),
    policy: titleize(mapping.syncPolicy),
    course: courseLabel(coursesById, mapping.courseId),
    section: sectionLabel(sectionsById, mapping.sectionId),
    externalCourseKey: mapping.externalCourseKey ?? "Not configured",
    externalSectionKey: mapping.externalSectionKey ?? "Not configured",
  }));
}

export function buildCourseCatalogReviewModel(config: CourseCatalogConfiguration): CourseCatalogReviewModel {
  const validation = validateCourseCatalogConfiguration(config);
  const coursesById = mapById(config.courses);
  const sectionsById = mapById(config.sections);
  const yearsById = mapById(config.academicYears);
  const periodsById = mapById(config.academicPeriods);
  const subdivisionsById = mapById(config.subdivisions);

  return {
    summary: {
      tenantId: config.catalogProfile.tenantId,
      institutionName: config.institutionProfile.institutionName,
      defaultRecordType: titleize(config.catalogProfile.defaultCourseRecordType),
      defaultDurationUnit: titleize(config.catalogProfile.defaultDurationUnit),
      lmsMapping: booleanLabel(config.catalogProfile.supportsLmsMapping),
      updatedAt: config.catalogProfile.updatedAt,
    },
    metrics: [
      { label: "Courses", value: String(config.courses.length), detail: "Catalog definitions" },
      { label: "Sections", value: String(config.sections.length), detail: "Scheduled instructional offerings" },
      { label: "LMS mappings", value: String(config.lmsMappings.length), detail: config.catalogProfile.supportsLmsMapping ? "Provider mapping enabled" : "Provider-neutral posture" },
      {
        label: "Validation",
        value: validation.length === 0 ? "Clear" : String(validation.length),
        detail: validation.length === 0 ? "No warnings" : "Warnings found",
      },
    ],
    profile: buildProfile(config),
    courseCoverage: buildCoverage(config.courses.map((course) => course.courseType), "Course type coverage"),
    recordCoverage: buildCoverage(config.courses.map((course) => course.recordType), "Official record posture"),
    courses: buildCourseItems(config, subdivisionsById),
    sections: buildSectionItems(config, coursesById, yearsById, periodsById, subdivisionsById),
    lmsMappings: buildLmsMappings(config, coursesById, sectionsById),
    validation,
  };
}
