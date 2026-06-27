import { AcademicPeriod, AcademicYear, InstitutionSubdivision } from "@/modules/academic-calendar/types";
import {
  Course,
  CourseCatalogConfiguration,
  CourseLmsMapping,
  CourseSection,
} from "@/modules/course-catalog/types";

export type { CourseCatalogConfiguration } from "@/modules/course-catalog/types";

function mapById<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function positive(value: number | undefined) {
  return typeof value === "number" && value > 0;
}

function hasCreditOrClockHourMeasure(course: Course) {
  return positive(course.defaultCredits) || positive(course.defaultClockHours) || positive(course.defaultDuration.creditHours) || positive(course.defaultDuration.clockHours);
}

function validateTenantScopes(config: CourseCatalogConfiguration, errors: string[]) {
  const tenantId = config.institutionProfile.tenantId;

  if (config.catalogProfile.tenantId !== tenantId) {
    errors.push("Course catalog profile tenant must match the institution tenant.");
  }

  for (const year of config.academicYears) {
    if (year.tenantId !== tenantId) {
      errors.push(`Academic year ${year.id} tenant must match the institution tenant.`);
    }
  }

  for (const period of config.academicPeriods) {
    if (period.tenantId !== tenantId) {
      errors.push(`Academic period ${period.id} tenant must match the institution tenant.`);
    }
  }

  for (const subdivision of config.subdivisions) {
    if (subdivision.tenantId !== tenantId) {
      errors.push(`Subdivision ${subdivision.id} tenant must match the institution tenant.`);
    }
  }

  for (const course of config.courses) {
    if (course.tenantId !== tenantId) {
      errors.push(`Course ${course.id} tenant must match the institution tenant.`);
    }
  }

  for (const section of config.sections) {
    if (section.tenantId !== tenantId) {
      errors.push(`Section ${section.id} tenant must match the institution tenant.`);
    }
  }

  for (const prerequisite of config.prerequisites) {
    if (prerequisite.tenantId !== tenantId) {
      errors.push(`Course prerequisite ${prerequisite.id} tenant must match the institution tenant.`);
    }
  }

  for (const mapping of config.lmsMappings) {
    if (mapping.tenantId !== tenantId) {
      errors.push(`LMS mapping ${mapping.id} tenant must match the institution tenant.`);
    }
  }
}

function validateCatalogProfile(config: CourseCatalogConfiguration, errors: string[]) {
  const rules = config.institutionProfile.operatingRules;
  const profile = config.catalogProfile;

  if (profile.supportsCredits && !rules.usesCredits) {
    errors.push("Course catalog cannot enable credits when institution credits are disabled.");
  }

  if (profile.supportsGradeLevels && !rules.usesGradeLevels && !config.institutionProfile.supportedModes.includes("childrens_school")) {
    errors.push("Course catalog cannot enable grade levels when institution grade levels are disabled.");
  }
}

function validateCourseReferences(
  course: Course,
  subdivisionsById: Map<string, InstitutionSubdivision>,
  errors: string[],
) {
  const owningSubdivision = course.owningSubdivisionId ? subdivisionsById.get(course.owningSubdivisionId) : undefined;
  const gradeBand = course.gradeBandSubdivisionId ? subdivisionsById.get(course.gradeBandSubdivisionId) : undefined;

  if (course.owningSubdivisionId && !owningSubdivision) {
    errors.push(`Course ${course.id} must reference an existing owning subdivision.`);
  } else if (owningSubdivision && owningSubdivision.tenantId !== course.tenantId) {
    errors.push(`Course ${course.id} owning subdivision must belong to the same tenant.`);
  }

  if (course.gradeBandSubdivisionId && !gradeBand) {
    errors.push(`Course ${course.id} must reference an existing grade band subdivision.`);
  } else if (gradeBand && gradeBand.tenantId !== course.tenantId) {
    errors.push(`Course ${course.id} grade band subdivision must belong to the same tenant.`);
  } else if (gradeBand && gradeBand.subdivisionType !== "grade_band") {
    errors.push(`Course ${course.id} grade band reference must point to a grade band subdivision.`);
  }
}

function validateCourses(config: CourseCatalogConfiguration, errors: string[]) {
  const subdivisionsById = mapById(config.subdivisions);

  for (const course of config.courses) {
    validateCourseReferences(course, subdivisionsById, errors);

    if (course.defaultDuration.durationValue <= 0) {
      errors.push(`Course ${course.id} duration must be positive.`);
    }

    if (course.recordType === "transcript" && !hasCreditOrClockHourMeasure(course)) {
      errors.push(`Transcript course ${course.id} must include credits or clock hours.`);
    }

    if (course.recordType === "transcript" && !config.institutionProfile.operatingRules.usesTranscripts) {
      errors.push(`Course ${course.id} cannot use transcript records when institution transcripts are disabled.`);
    }

    if ((course.courseType === "children_class" || course.courseLevel === "children") && !course.gradeBandSubdivisionId) {
      errors.push(`Children's school course ${course.id} must reference a grade band subdivision.`);
    }

    if (course.defaultDuration.durationUnit === "credit_hour" && !positive(course.defaultCredits) && !positive(course.defaultDuration.creditHours)) {
      errors.push(`Course ${course.id} credit-hour duration must include credit hours.`);
    }

    if (course.defaultDuration.durationUnit === "clock_hour" && !positive(course.defaultClockHours) && !positive(course.defaultDuration.clockHours)) {
      errors.push(`Course ${course.id} clock-hour duration must include clock hours.`);
    }

    if (course.defaultDuration.competencyCount && !course.defaultCompetencySetId) {
      errors.push(`Course ${course.id} competency duration must reference a competency set.`);
    }
  }
}

function validateSectionReferenceTenants(
  section: CourseSection,
  course: Course | undefined,
  period: AcademicPeriod | undefined,
  subdivision: InstitutionSubdivision | undefined,
  errors: string[],
) {
  if (course && course.tenantId !== section.tenantId) {
    errors.push(`Section ${section.id} course must belong to the same tenant.`);
  }
  if (period && period.tenantId !== section.tenantId) {
    errors.push(`Section ${section.id} academic period must belong to the same tenant.`);
  }
  if (subdivision && subdivision.tenantId !== section.tenantId) {
    errors.push(`Section ${section.id} subdivision must belong to the same tenant.`);
  }
}

function validateSections(config: CourseCatalogConfiguration, errors: string[]) {
  const coursesById = mapById(config.courses);
  const periodsById = mapById(config.academicPeriods);
  const subdivisionsById = mapById(config.subdivisions);

  for (const section of config.sections) {
    const course = coursesById.get(section.courseId);
    const period = periodsById.get(section.academicPeriodId);
    const subdivision = section.subdivisionId ? subdivisionsById.get(section.subdivisionId) : undefined;

    if (!course) {
      errors.push(`Section ${section.id} must reference an existing course.`);
    }
    if (!period) {
      errors.push(`Section ${section.id} must reference an academic period.`);
    }
    if (section.subdivisionId && !subdivision) {
      errors.push(`Section ${section.id} must reference an existing subdivision.`);
    }

    validateSectionReferenceTenants(section, course, period, subdivision, errors);

    if (section.capacity !== undefined && section.capacity <= 0) {
      errors.push(`Section ${section.id} capacity must be positive when configured.`);
    }

    if ((section.status === "open" || section.status === "in_progress") && !section.primaryInstructorId) {
      errors.push(`Section ${section.id} must include a primary instructor before it can open or start.`);
    }
  }
}

function detectPrerequisiteCycle(courseId: string, edges: Map<string, string[]>, visiting: Set<string>, visited: Set<string>): boolean {
  if (visiting.has(courseId)) {
    return true;
  }
  if (visited.has(courseId)) {
    return false;
  }

  visiting.add(courseId);
  for (const requiredCourseId of edges.get(courseId) ?? []) {
    if (detectPrerequisiteCycle(requiredCourseId, edges, visiting, visited)) {
      return true;
    }
  }
  visiting.delete(courseId);
  visited.add(courseId);
  return false;
}

function validatePrerequisites(config: CourseCatalogConfiguration, errors: string[]) {
  const coursesById = mapById(config.courses);
  const edges = new Map<string, string[]>();

  for (const prerequisite of config.prerequisites) {
    const course = coursesById.get(prerequisite.courseId);
    const requiredCourse = coursesById.get(prerequisite.requiredCourseId);

    if (!course) {
      errors.push(`Course prerequisite ${prerequisite.id} must reference an existing course.`);
    }
    if (!requiredCourse) {
      errors.push(`Course prerequisite ${prerequisite.id} must reference an existing required course.`);
    }
    if (course && course.tenantId !== prerequisite.tenantId) {
      errors.push(`Course prerequisite ${prerequisite.id} course must belong to the same tenant.`);
    }
    if (requiredCourse && requiredCourse.tenantId !== prerequisite.tenantId) {
      errors.push(`Course prerequisite ${prerequisite.id} required course must belong to the same tenant.`);
    }

    edges.set(prerequisite.courseId, [...(edges.get(prerequisite.courseId) ?? []), prerequisite.requiredCourseId]);
  }

  const visited = new Set<string>();
  for (const course of config.courses) {
    if (detectPrerequisiteCycle(course.id, edges, new Set<string>(), visited)) {
      errors.push(`Course prerequisite cycle detected for ${course.id}.`);
      break;
    }
  }
}

function validateLmsMappingReferences(
  mapping: CourseLmsMapping,
  coursesById: Map<string, Course>,
  sectionsById: Map<string, CourseSection>,
  errors: string[],
) {
  const course = mapping.courseId ? coursesById.get(mapping.courseId) : undefined;
  const section = mapping.sectionId ? sectionsById.get(mapping.sectionId) : undefined;

  if (mapping.courseId && !course) {
    errors.push(`LMS mapping ${mapping.id} must reference an existing course.`);
  } else if (course && course.tenantId !== mapping.tenantId) {
    errors.push(`LMS mapping ${mapping.id} course must belong to the same tenant.`);
  }

  if (mapping.sectionId && !section) {
    errors.push(`LMS mapping ${mapping.id} must reference an existing section.`);
  } else if (section && section.tenantId !== mapping.tenantId) {
    errors.push(`LMS mapping ${mapping.id} section must belong to the same tenant.`);
  }
}

function validateLmsMappings(config: CourseCatalogConfiguration, errors: string[]) {
  const coursesById = mapById(config.courses);
  const sectionsById = mapById(config.sections);

  for (const mapping of config.lmsMappings) {
    validateLmsMappingReferences(mapping, coursesById, sectionsById, errors);

    if (!config.catalogProfile.supportsLmsMapping && mapping.mappingStatus !== "not_required") {
      errors.push(`LMS mapping ${mapping.id} cannot be active when course catalog LMS mapping is disabled.`);
    }

    if (mapping.provider === "none" && mapping.mappingStatus !== "not_required") {
      errors.push(`LMS mapping ${mapping.id} with no provider must be marked not required.`);
    }

    if ((mapping.mappingStatus === "mapped" || mapping.mappingStatus === "ready_to_provision") && !mapping.courseId && !mapping.sectionId) {
      errors.push(`LMS mapping ${mapping.id} must reference a course or section before provisioning.`);
    }

    if (mapping.syncPolicy === "grade_return") {
      errors.push(`LMS mapping ${mapping.id} cannot enable grade return until the grading contract exists.`);
    }

    if (mapping.syncPolicy === "full_section_sync") {
      errors.push(`LMS mapping ${mapping.id} cannot enable full section sync until enrollment and grading contracts exist.`);
    }
  }
}

export function validateCourseCatalogConfiguration(config: CourseCatalogConfiguration): string[] {
  const errors: string[] = [];

  validateTenantScopes(config, errors);
  validateCatalogProfile(config, errors);
  validateCourses(config, errors);
  validateSections(config, errors);
  validatePrerequisites(config, errors);
  validateLmsMappings(config, errors);

  return errors;
}
