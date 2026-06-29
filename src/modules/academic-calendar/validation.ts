import {
  AcademicCalendarConfiguration,
  AcademicPeriod,
  AcademicPeriodType,
  AcademicYear,
  InstitutionSubdivision,
} from "@/modules/academic-calendar/types";
import { normalizeSelectedInstitutionModes, resolveInstitutionModel } from "@/modules/academy-config/mode-packs";
import { InstitutionMode } from "@/modules/academy-config/types";

export type { AcademicCalendarConfiguration } from "@/modules/academic-calendar/types";

const instructionalPeriodTypes = new Set<AcademicPeriodType>(["term", "session", "module", "intensive", "reporting_period"]);

function dateValue(value: string) {
  return new Date(value).getTime();
}

function startsBeforeEnd(startsOn: string, endsOn: string) {
  return dateValue(startsOn) < dateValue(endsOn);
}

function containsDateRange(container: { startsOn: string; endsOn: string }, child: { startsOn: string; endsOn: string }) {
  return dateValue(container.startsOn) <= dateValue(child.startsOn) && dateValue(child.endsOn) <= dateValue(container.endsOn);
}

function overlaps(a: { startsOn: string; endsOn: string }, b: { startsOn: string; endsOn: string }) {
  return dateValue(a.startsOn) <= dateValue(b.endsOn) && dateValue(b.startsOn) <= dateValue(a.endsOn);
}

function activeYearScope(year: AcademicYear) {
  return `${year.tenantId}:${year.subdivisionId ?? "tenant"}`;
}

function concreteModes(modes: InstitutionMode[]) {
  return normalizeSelectedInstitutionModes(modes);
}

function findPeriod(periods: AcademicPeriod[], id: string) {
  return periods.find((period) => period.id === id);
}

function findSubdivision(subdivisions: InstitutionSubdivision[], id: string | undefined) {
  return id ? subdivisions.find((subdivision) => subdivision.id === id) : undefined;
}

function validateTenantScopes(config: AcademicCalendarConfiguration, errors: string[]) {
  const tenantId = config.institutionProfile.tenantId;

  if (config.calendarProfile.tenantId !== tenantId) {
    errors.push("Academic calendar profile tenant must match the institution tenant.");
  }

  for (const year of config.academicYears) {
    if (year.tenantId !== tenantId) {
      errors.push(`Academic year ${year.id} tenant must match the institution tenant.`);
    }
  }

  for (const period of config.periods) {
    if (period.tenantId !== tenantId) {
      errors.push(`Academic period ${period.id} tenant must match the institution tenant.`);
    }
  }

  for (const subdivision of config.subdivisions) {
    if (subdivision.tenantId !== tenantId) {
      errors.push(`Subdivision ${subdivision.id} tenant must match the institution tenant.`);
    }
  }
}

function validateAcademicYears(config: AcademicCalendarConfiguration, errors: string[]) {
  for (const year of config.academicYears) {
    if (!startsBeforeEnd(year.startsOn, year.endsOn)) {
      errors.push(`Academic year ${year.id} must end after it starts.`);
    }
  }

  const activeYears = config.academicYears.filter((year) => year.status === "active");
  for (let index = 0; index < activeYears.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < activeYears.length; compareIndex += 1) {
      const current = activeYears[index];
      const next = activeYears[compareIndex];
      if (activeYearScope(current) === activeYearScope(next) && overlaps(current, next)) {
        errors.push(`Active academic years ${current.id} and ${next.id} overlap for the same tenant and subdivision.`);
      }
    }
  }
}

function validatePeriods(config: AcademicCalendarConfiguration, errors: string[]) {
  for (const period of config.periods) {
    const year = config.academicYears.find((item) => item.id === period.academicYearId);

    if (!startsBeforeEnd(period.startsOn, period.endsOn)) {
      errors.push(`Academic period ${period.id} must end after it starts.`);
    }

    if (!year) {
      errors.push(`Academic period ${period.id} must reference an academic year.`);
    } else if (!containsDateRange(year, period)) {
      errors.push(`Academic period ${period.id} must fall inside its academic year.`);
    }

    if (period.parentPeriodId) {
      const parent = findPeriod(config.periods, period.parentPeriodId);
      if (!parent) {
        errors.push(`Academic period ${period.id} must reference an existing parent period.`);
      } else if (!containsDateRange(parent, period)) {
        errors.push(`Academic period ${period.id} must fall inside its parent period.`);
      }
    }
  }
}

function validateEnrollmentWindows(config: AcademicCalendarConfiguration, errors: string[]) {
  for (const window of config.enrollmentWindows) {
    const period = findPeriod(config.periods, window.academicPeriodId);

    if (window.closesAt && dateValue(window.opensAt) >= dateValue(window.closesAt)) {
      errors.push(`Enrollment window ${window.id} must close after it opens.`);
    }

    if (!window.closesAt && !(window.windowType === "application" && config.calendarProfile.calendarSystem === "rolling_enrollment")) {
      errors.push(`Enrollment window ${window.id} must include a close time.`);
    }

    if (!period) {
      errors.push(`Enrollment window ${window.id} must reference an academic period.`);
      continue;
    }

    if ((window.windowType === "registration" || window.windowType === "add_drop") && period.periodType === "break") {
      errors.push("Registration and add/drop windows cannot target break periods.");
    } else if ((window.windowType === "registration" || window.windowType === "add_drop") && !instructionalPeriodTypes.has(period.periodType)) {
      errors.push(`Enrollment window ${window.id} must target an instructional period.`);
    }
  }
}

function validateGradingWindows(config: AcademicCalendarConfiguration, errors: string[]) {
  for (const window of config.gradingWindows) {
    const period = findPeriod(config.periods, window.academicPeriodId);

    if (dateValue(window.opensAt) >= dateValue(window.closesAt)) {
      errors.push(`Grading window ${window.id} must close after it opens.`);
    }

    if (!period) {
      errors.push(`Grading window ${window.id} must reference an academic period.`);
    }
  }
}

function validateTranscriptPeriods(config: AcademicCalendarConfiguration, errors: string[]) {
  const requiresTranscriptPeriod = config.institutionProfile.operatingRules.usesTranscripts;
  const hasTranscriptPeriod = config.transcriptPeriods.some((period) => period.recordType === "transcript");

  if (requiresTranscriptPeriod && !hasTranscriptPeriod) {
    errors.push("Transcript-bearing institutions must include at least one transcript period.");
  }

  for (const period of config.transcriptPeriods) {
    if (dateValue(period.postingOpensAt) >= dateValue(period.postingClosesAt)) {
      errors.push(`Transcript period ${period.id} must close after it opens.`);
    }

    if (!findPeriod(config.periods, period.academicPeriodId)) {
      errors.push(`Transcript period ${period.id} must reference an academic period.`);
    }

    if (!config.institutionProfile.operatingRules.usesTranscripts && period.recordType === "transcript") {
      errors.push(`Transcript period ${period.id} cannot use transcript records when institution transcripts are disabled.`);
    }
  }
}

function validateSubdivisions(config: AcademicCalendarConfiguration, errors: string[]) {
  const hasChildrensSchool = config.institutionProfile.supportedModes.includes("childrens_school");
  const hasGradeBand = config.subdivisions.some(
    (subdivision) =>
      subdivision.status === "active" &&
      subdivision.subdivisionType === "grade_band" &&
      (!subdivision.institutionMode || subdivision.institutionMode === "childrens_school"),
  );

  if (hasChildrensSchool && config.institutionProfile.operatingRules.usesGradeLevels && !hasGradeBand) {
    errors.push("Children's school calendars with grade levels must include at least one grade band subdivision.");
  }

  for (const subdivision of config.subdivisions) {
    const parent = findSubdivision(config.subdivisions, subdivision.parentSubdivisionId);
    if (subdivision.parentSubdivisionId && !parent) {
      errors.push(`Subdivision ${subdivision.id} must reference an existing parent subdivision.`);
    }
    if (parent && parent.tenantId !== subdivision.tenantId) {
      errors.push(`Subdivision ${subdivision.id} parent must belong to the same tenant.`);
    }
  }
}

function validateMixedInstitutionBranches(config: AcademicCalendarConfiguration, errors: string[]) {
  const selectedModes = concreteModes(config.institutionProfile.supportedModes);
  if (resolveInstitutionModel(selectedModes) !== "multi_mode") {
    return;
  }

  const branchTypes = new Set(["campus", "school", "department", "division"]);
  const activeModes = new Set(
    config.subdivisions
      .filter((subdivision) => subdivision.status === "active" && subdivision.institutionMode && branchTypes.has(subdivision.subdivisionType))
      .map((subdivision) => subdivision.institutionMode),
  );

  for (const mode of selectedModes) {
    if (!activeModes.has(mode)) {
      errors.push(`Mixed institutions must include an active subdivision branch for ${mode} mode.`);
    }
  }
}

export function validateAcademicCalendarConfiguration(config: AcademicCalendarConfiguration): string[] {
  const errors: string[] = [];

  validateTenantScopes(config, errors);
  validateAcademicYears(config, errors);
  validatePeriods(config, errors);
  validateEnrollmentWindows(config, errors);
  validateGradingWindows(config, errors);
  validateTranscriptPeriods(config, errors);
  validateSubdivisions(config, errors);
  validateMixedInstitutionBranches(config, errors);

  return errors;
}
