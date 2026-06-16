import { getDatabasePool } from "@/lib/database";
import {
  AcademicCalendarConfiguration,
  AcademicCalendarProfile,
  AcademicPeriod,
  AcademicYear,
  EnrollmentWindow,
  GradingWindow,
  InstitutionSubdivision,
  TranscriptPeriod,
} from "@/modules/academic-calendar/types";
import { mapInstitutionProfileRow } from "@/modules/academy-config/postgres-repository";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function toDateString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
}

function optionalString(value: unknown) {
  return value === null || value === undefined ? undefined : String(value);
}

function optionalIsoString(value: unknown) {
  return value === null || value === undefined ? null : toIsoString(value);
}

function mapCalendarProfileRow(row: Record<string, unknown>): AcademicCalendarProfile {
  return {
    tenantId: String(row.tenant_id),
    calendarSystem: row.calendar_system as AcademicCalendarProfile["calendarSystem"],
    defaultTermStructure: row.default_term_structure as AcademicCalendarProfile["defaultTermStructure"],
    timezone: String(row.timezone),
    weekStartsOn: row.week_starts_on as AcademicCalendarProfile["weekStartsOn"],
    usesInstructionalDays: Boolean(row.uses_instructional_days),
    usesEnrollmentWindows: Boolean(row.uses_enrollment_windows),
    usesGradingWindows: Boolean(row.uses_grading_windows),
    usesTranscriptPeriods: Boolean(row.uses_transcript_periods),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapAcademicYearRow(row: Record<string, unknown>): AcademicYear {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    code: String(row.code),
    startsOn: toDateString(row.starts_on),
    endsOn: toDateString(row.ends_on),
    status: row.status as AcademicYear["status"],
    calendarSystem: row.calendar_system as AcademicYear["calendarSystem"],
    subdivisionId: optionalString(row.subdivision_id),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapAcademicPeriodRow(row: Record<string, unknown>): AcademicPeriod {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    academicYearId: String(row.academic_year_id),
    parentPeriodId: optionalString(row.parent_period_id),
    subdivisionId: optionalString(row.subdivision_id),
    name: String(row.name),
    code: String(row.code),
    periodType: row.period_type as AcademicPeriod["periodType"],
    startsOn: toDateString(row.starts_on),
    endsOn: toDateString(row.ends_on),
    sequence: Number(row.sequence),
    status: row.status as AcademicPeriod["status"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapEnrollmentWindowRow(row: Record<string, unknown>): EnrollmentWindow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    academicPeriodId: String(row.academic_period_id),
    windowType: row.window_type as EnrollmentWindow["windowType"],
    opensAt: toIsoString(row.opens_at),
    closesAt: optionalIsoString(row.closes_at),
    appliesToSubdivisionId: optionalString(row.applies_to_subdivision_id),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapGradingWindowRow(row: Record<string, unknown>): GradingWindow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    academicPeriodId: String(row.academic_period_id),
    opensAt: toIsoString(row.opens_at),
    closesAt: toIsoString(row.closes_at),
    gradePostingPolicy: row.grade_posting_policy as GradingWindow["gradePostingPolicy"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapTranscriptPeriodRow(row: Record<string, unknown>): TranscriptPeriod {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    academicPeriodId: String(row.academic_period_id),
    recordType: row.record_type as TranscriptPeriod["recordType"],
    postingOpensAt: toIsoString(row.posting_opens_at),
    postingClosesAt: toIsoString(row.posting_closes_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapSubdivisionRow(row: Record<string, unknown>): InstitutionSubdivision {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    parentSubdivisionId: optionalString(row.parent_subdivision_id),
    name: String(row.name),
    code: String(row.code),
    subdivisionType: row.subdivision_type as InstitutionSubdivision["subdivisionType"],
    institutionMode: row.institution_mode as InstitutionSubdivision["institutionMode"],
    status: row.status as InstitutionSubdivision["status"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapAcademicCalendarRows(rows: {
  institutionProfile: Record<string, unknown>;
  calendarProfile: Record<string, unknown>;
  academicYears: Record<string, unknown>[];
  periods: Record<string, unknown>[];
  enrollmentWindows: Record<string, unknown>[];
  gradingWindows: Record<string, unknown>[];
  transcriptPeriods: Record<string, unknown>[];
  subdivisions: Record<string, unknown>[];
}): AcademicCalendarConfiguration {
  return {
    institutionProfile: mapInstitutionProfileRow(rows.institutionProfile),
    calendarProfile: mapCalendarProfileRow(rows.calendarProfile),
    academicYears: rows.academicYears.map(mapAcademicYearRow),
    periods: rows.periods.map(mapAcademicPeriodRow),
    enrollmentWindows: rows.enrollmentWindows.map(mapEnrollmentWindowRow),
    gradingWindows: rows.gradingWindows.map(mapGradingWindowRow),
    transcriptPeriods: rows.transcriptPeriods.map(mapTranscriptPeriodRow),
    subdivisions: rows.subdivisions.map(mapSubdivisionRow),
  };
}

export class AcademyCalendarRepository {
  constructor(private readonly pool: Queryable = getDatabasePool()) {}

  async fetchAcademicCalendarConfiguration(tenantId: string) {
    const institutionProfile = await this.pool.query(
      `select tenant_id, institution_name, legal_name, primary_mode, supported_modes, operating_rules,
              capabilities, lms_preference, created_at, updated_at
       from academy_institution_profiles
       where tenant_id = $1`,
      [tenantId],
    );
    const calendarProfile = await this.pool.query("select * from academy_calendar_profiles where tenant_id = $1", [tenantId]);
    const academicYears = await this.pool.query("select * from academy_academic_years where tenant_id = $1 order by starts_on asc", [tenantId]);
    const periods = await this.pool.query("select * from academy_academic_periods where tenant_id = $1 order by sequence asc, starts_on asc", [tenantId]);
    const enrollmentWindows = await this.pool.query("select * from academy_enrollment_windows where tenant_id = $1 order by opens_at asc", [tenantId]);
    const gradingWindows = await this.pool.query("select * from academy_grading_windows where tenant_id = $1 order by opens_at asc", [tenantId]);
    const transcriptPeriods = await this.pool.query("select * from academy_transcript_periods where tenant_id = $1 order by posting_opens_at asc", [tenantId]);
    const subdivisions = await this.pool.query("select * from academy_institution_subdivisions where tenant_id = $1 order by subdivision_type asc, name asc", [
      tenantId,
    ]);

    if (institutionProfile.rowCount === 0) {
      throw new Error(`Institution profile for tenant ${tenantId} was not found.`);
    }

    if (calendarProfile.rowCount === 0) {
      throw new Error(`Academic calendar profile for tenant ${tenantId} was not found.`);
    }

    return mapAcademicCalendarRows({
      institutionProfile: institutionProfile.rows[0],
      calendarProfile: calendarProfile.rows[0],
      academicYears: academicYears.rows,
      periods: periods.rows,
      enrollmentWindows: enrollmentWindows.rows,
      gradingWindows: gradingWindows.rows,
      transcriptPeriods: transcriptPeriods.rows,
      subdivisions: subdivisions.rows,
    });
  }
}
