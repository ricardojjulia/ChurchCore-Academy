import {
  AcademicCalendarConfiguration,
  AcademicPeriod,
  AcademicYear,
  EnrollmentWindow,
  GradingWindow,
  InstitutionSubdivision,
  TranscriptPeriod,
} from "@/modules/academic-calendar/types";
import { validateAcademicCalendarConfiguration } from "@/modules/academic-calendar/validation";

export interface CalendarReviewMetric {
  label: string;
  value: string;
  detail: string;
}

export interface CalendarReviewItem {
  label: string;
  value: string;
}

export interface AcademicYearReviewItem {
  name: string;
  code: string;
  status: string;
  calendarSystem: string;
  range: string;
  subdivision: string;
}

export interface AcademicPeriodReviewItem {
  name: string;
  code: string;
  type: string;
  status: string;
  range: string;
  sequence: string;
  academicYear: string;
  subdivision: string;
}

export interface EnrollmentWindowReviewItem {
  type: string;
  period: string;
  range: string;
}

export interface GradingWindowReviewItem {
  period: string;
  range: string;
  policy: string;
}

export interface TranscriptPeriodReviewItem {
  period: string;
  range: string;
  recordType: string;
}

export interface SubdivisionReviewItem {
  name: string;
  code: string;
  type: string;
  mode: string;
  parent: string;
  status: string;
}

export interface AcademicCalendarReviewModel {
  summary: {
    tenantId: string;
    institutionName: string;
    calendarSystem: string;
    termStructure: string;
    timezone: string;
    weekStartsOn: string;
    updatedAt: string;
  };
  metrics: CalendarReviewMetric[];
  profile: CalendarReviewItem[];
  academicYears: AcademicYearReviewItem[];
  periods: AcademicPeriodReviewItem[];
  enrollmentWindows: EnrollmentWindowReviewItem[];
  gradingWindows: GradingWindowReviewItem[];
  transcriptPeriods: TranscriptPeriodReviewItem[];
  subdivisions: SubdivisionReviewItem[];
  validation: string[];
}

const labelOverrides: Record<string, string> = {
  bible_school: "Bible school",
  childrens_school: "Children's school",
  rolling_enrollment: "Rolling enrollment",
  school_year: "School year",
  academic_year: "Academic year",
  grade_band: "Grade band",
  registrar_posting: "Registrar posting",
  completion_record: "Completion record",
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatRange(startsAt: string, endsAt?: string | null) {
  return `${formatDate(startsAt)} - ${endsAt ? formatDate(endsAt) : "Open ended"}`;
}

function mapById<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
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

function buildProfile(config: AcademicCalendarConfiguration): CalendarReviewItem[] {
  const profile = config.calendarProfile;

  return [
    { label: "Tenant", value: profile.tenantId },
    { label: "Calendar system", value: titleize(profile.calendarSystem) },
    { label: "Term structure", value: titleize(profile.defaultTermStructure) },
    { label: "Timezone", value: profile.timezone },
    { label: "Week starts on", value: titleize(profile.weekStartsOn) },
    { label: "Instructional days", value: booleanLabel(profile.usesInstructionalDays) },
    { label: "Enrollment windows", value: booleanLabel(profile.usesEnrollmentWindows) },
    { label: "Grading windows", value: booleanLabel(profile.usesGradingWindows) },
    { label: "Transcript periods", value: booleanLabel(profile.usesTranscriptPeriods) },
  ];
}

function buildAcademicYears(config: AcademicCalendarConfiguration, subdivisionsById: Map<string, InstitutionSubdivision>): AcademicYearReviewItem[] {
  return config.academicYears.map((year) => ({
    name: year.name,
    code: year.code,
    status: titleize(year.status),
    calendarSystem: titleize(year.calendarSystem),
    range: formatRange(year.startsOn, year.endsOn),
    subdivision: subdivisionName(subdivisionsById, year.subdivisionId),
  }));
}

function buildPeriods(
  config: AcademicCalendarConfiguration,
  yearsById: Map<string, AcademicYear>,
  subdivisionsById: Map<string, InstitutionSubdivision>,
): AcademicPeriodReviewItem[] {
  return config.periods.map((period) => ({
    name: period.name,
    code: period.code,
    type: titleize(period.periodType),
    status: titleize(period.status),
    range: formatRange(period.startsOn, period.endsOn),
    sequence: String(period.sequence),
    academicYear: academicYearName(yearsById, period.academicYearId),
    subdivision: subdivisionName(subdivisionsById, period.subdivisionId),
  }));
}

function buildEnrollmentWindows(windows: EnrollmentWindow[], periodsById: Map<string, AcademicPeriod>): EnrollmentWindowReviewItem[] {
  return windows.map((window) => ({
    type: titleize(window.windowType),
    period: periodName(periodsById, window.academicPeriodId),
    range: formatRange(window.opensAt, window.closesAt),
  }));
}

function buildGradingWindows(windows: GradingWindow[], periodsById: Map<string, AcademicPeriod>): GradingWindowReviewItem[] {
  return windows.map((window) => ({
    period: periodName(periodsById, window.academicPeriodId),
    range: formatRange(window.opensAt, window.closesAt),
    policy: titleize(window.gradePostingPolicy),
  }));
}

function buildTranscriptPeriods(periods: TranscriptPeriod[], periodsById: Map<string, AcademicPeriod>): TranscriptPeriodReviewItem[] {
  return periods.map((period) => ({
    period: periodName(periodsById, period.academicPeriodId),
    range: formatRange(period.postingOpensAt, period.postingClosesAt),
    recordType: titleize(period.recordType),
  }));
}

function buildSubdivisions(config: AcademicCalendarConfiguration, subdivisionsById: Map<string, InstitutionSubdivision>): SubdivisionReviewItem[] {
  return config.subdivisions.map((subdivision) => ({
    name: subdivision.name,
    code: subdivision.code,
    type: titleize(subdivision.subdivisionType),
    mode: subdivision.institutionMode ? titleize(subdivision.institutionMode) : "Shared",
    parent: subdivision.parentSubdivisionId ? subdivisionsById.get(subdivision.parentSubdivisionId)?.name ?? "Unknown parent" : "Root",
    status: titleize(subdivision.status),
  }));
}

export function buildAcademicCalendarReviewModel(config: AcademicCalendarConfiguration): AcademicCalendarReviewModel {
  const validation = validateAcademicCalendarConfiguration(config);
  const yearsById = mapById(config.academicYears);
  const periodsById = mapById(config.periods);
  const subdivisionsById = mapById(config.subdivisions);

  return {
    summary: {
      tenantId: config.calendarProfile.tenantId,
      institutionName: config.institutionProfile.institutionName,
      calendarSystem: titleize(config.calendarProfile.calendarSystem),
      termStructure: titleize(config.calendarProfile.defaultTermStructure),
      timezone: config.calendarProfile.timezone,
      weekStartsOn: titleize(config.calendarProfile.weekStartsOn),
      updatedAt: config.calendarProfile.updatedAt,
    },
    metrics: [
      { label: "Academic years", value: String(config.academicYears.length), detail: `${config.periods.length} configured periods` },
      { label: "Periods", value: String(config.periods.length), detail: `${config.enrollmentWindows.length} enrollment windows` },
      { label: "Subdivisions", value: String(config.subdivisions.length), detail: "Schools, grade bands, and cohorts" },
      {
        label: "Validation",
        value: validation.length === 0 ? "Clear" : String(validation.length),
        detail: validation.length === 0 ? "No warnings" : "Warnings found",
      },
    ],
    profile: buildProfile(config),
    academicYears: buildAcademicYears(config, subdivisionsById),
    periods: buildPeriods(config, yearsById, subdivisionsById),
    enrollmentWindows: buildEnrollmentWindows(config.enrollmentWindows, periodsById),
    gradingWindows: buildGradingWindows(config.gradingWindows, periodsById),
    transcriptPeriods: buildTranscriptPeriods(config.transcriptPeriods, periodsById),
    subdivisions: buildSubdivisions(config, subdivisionsById),
    validation,
  };
}
