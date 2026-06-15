import { getDatabasePool } from "@/lib/database";
import { AcademicPeriod, AcademicYear, InstitutionSubdivision } from "@/modules/academic-calendar/types";
import { mapInstitutionProfileRow } from "@/modules/academy-config/postgres-repository";
import {
  Course,
  CourseCatalogConfiguration,
  CourseCatalogProfile,
  CourseDuration,
  CourseLmsMapping,
  CoursePrerequisite,
  CourseSection,
} from "@/modules/course-catalog/types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function parseJson<T>(value: unknown): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
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

function optionalNumber(value: unknown) {
  return value === null || value === undefined ? undefined : Number(value);
}

function optionalIsoString(value: unknown) {
  return value === null || value === undefined ? undefined : toIsoString(value);
}

function mapCatalogProfileRow(row: Record<string, unknown>): CourseCatalogProfile {
  return {
    tenantId: String(row.tenant_id),
    defaultCourseRecordType: row.default_course_record_type as CourseCatalogProfile["defaultCourseRecordType"],
    defaultDurationUnit: row.default_duration_unit as CourseCatalogProfile["defaultDurationUnit"],
    supportsCredits: Boolean(row.supports_credits),
    supportsClockHours: Boolean(row.supports_clock_hours),
    supportsCompetencies: Boolean(row.supports_competencies),
    supportsNarrativeEvaluation: Boolean(row.supports_narrative_evaluation),
    supportsGradeLevels: Boolean(row.supports_grade_levels),
    supportsLmsMapping: Boolean(row.supports_lms_mapping),
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

function mapCourseRow(row: Record<string, unknown>): Course {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    code: String(row.code),
    title: String(row.title),
    description: String(row.description),
    courseType: row.course_type as Course["courseType"],
    courseLevel: row.course_level as Course["courseLevel"],
    recordType: row.record_type as Course["recordType"],
    defaultDuration: parseJson<CourseDuration>(row.default_duration),
    defaultCredits: optionalNumber(row.default_credits),
    defaultClockHours: optionalNumber(row.default_clock_hours),
    defaultCompetencySetId: optionalString(row.default_competency_set_id),
    owningSubdivisionId: optionalString(row.owning_subdivision_id),
    gradeBandSubdivisionId: optionalString(row.grade_band_subdivision_id),
    status: row.status as Course["status"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapSectionRow(row: Record<string, unknown>): CourseSection {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    courseId: String(row.course_id),
    academicYearId: String(row.academic_year_id),
    academicPeriodId: String(row.academic_period_id),
    subdivisionId: optionalString(row.subdivision_id),
    sectionCode: String(row.section_code),
    titleOverride: optionalString(row.title_override),
    deliveryMode: row.delivery_mode as CourseSection["deliveryMode"],
    schedulePattern: optionalString(row.schedule_pattern),
    capacity: optionalNumber(row.capacity),
    status: row.status as CourseSection["status"],
    primaryInstructorRole: row.primary_instructor_role as CourseSection["primaryInstructorRole"],
    primaryInstructorId: optionalString(row.primary_instructor_id),
    assistantInstructorIds: parseJson<string[]>(row.assistant_instructor_ids),
    lmsMappingId: optionalString(row.lms_mapping_id),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapPrerequisiteRow(row: Record<string, unknown>): CoursePrerequisite {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    courseId: String(row.course_id),
    requiredCourseId: String(row.required_course_id),
    requirementType: row.requirement_type as CoursePrerequisite["requirementType"],
    minimumGradeRuleId: optionalString(row.minimum_grade_rule_id),
    notes: optionalString(row.notes),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapLmsMappingRow(row: Record<string, unknown>): CourseLmsMapping {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    courseId: optionalString(row.course_id),
    sectionId: optionalString(row.section_id),
    provider: row.provider as CourseLmsMapping["provider"],
    mappingStatus: row.mapping_status as CourseLmsMapping["mappingStatus"],
    externalCourseKey: optionalString(row.external_course_key),
    externalSectionKey: optionalString(row.external_section_key),
    syncPolicy: row.sync_policy as CourseLmsMapping["syncPolicy"],
    lastReviewedAt: optionalIsoString(row.last_reviewed_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapCourseCatalogRows(rows: {
  institutionProfile: Record<string, unknown>;
  catalogProfile: Record<string, unknown>;
  academicYears: Record<string, unknown>[];
  academicPeriods: Record<string, unknown>[];
  subdivisions: Record<string, unknown>[];
  courses: Record<string, unknown>[];
  sections: Record<string, unknown>[];
  prerequisites: Record<string, unknown>[];
  lmsMappings: Record<string, unknown>[];
}): CourseCatalogConfiguration {
  return {
    institutionProfile: mapInstitutionProfileRow(rows.institutionProfile),
    catalogProfile: mapCatalogProfileRow(rows.catalogProfile),
    academicYears: rows.academicYears.map(mapAcademicYearRow),
    academicPeriods: rows.academicPeriods.map(mapAcademicPeriodRow),
    subdivisions: rows.subdivisions.map(mapSubdivisionRow),
    courses: rows.courses.map(mapCourseRow),
    sections: rows.sections.map(mapSectionRow),
    prerequisites: rows.prerequisites.map(mapPrerequisiteRow),
    lmsMappings: rows.lmsMappings.map(mapLmsMappingRow),
  };
}

export class AcademyCourseCatalogRepository {
  constructor(private readonly pool: Queryable = getDatabasePool()) {}

  async fetchCourseCatalogConfiguration(tenantId: string) {
    const institutionProfile = await this.pool.query(
      `select tenant_id, institution_name, legal_name, primary_mode, supported_modes, operating_rules,
              capabilities, lms_preference, created_at, updated_at
       from academy_institution_profiles
       where tenant_id = $1`,
      [tenantId],
    );
    const catalogProfile = await this.pool.query("select * from academy_course_catalog_profiles where tenant_id = $1", [tenantId]);
    const academicYears = await this.pool.query("select * from academy_academic_years where tenant_id = $1 order by starts_on asc", [tenantId]);
    const academicPeriods = await this.pool.query("select * from academy_academic_periods where tenant_id = $1 order by sequence asc, starts_on asc", [tenantId]);
    const subdivisions = await this.pool.query("select * from academy_institution_subdivisions where tenant_id = $1 order by subdivision_type asc, name asc", [
      tenantId,
    ]);
    const courses = await this.pool.query("select * from academy_courses where tenant_id = $1 order by code asc", [tenantId]);
    const sections = await this.pool.query("select * from academy_course_sections where tenant_id = $1 order by section_code asc", [tenantId]);
    const prerequisites = await this.pool.query("select * from academy_course_prerequisites where tenant_id = $1 order by course_id asc", [tenantId]);
    const lmsMappings = await this.pool.query("select * from academy_course_lms_mappings where tenant_id = $1 order by mapping_status asc, provider asc", [
      tenantId,
    ]);

    if (institutionProfile.rowCount === 0) {
      throw new Error(`Institution profile for tenant ${tenantId} was not found.`);
    }

    if (catalogProfile.rowCount === 0) {
      throw new Error(`Course catalog profile for tenant ${tenantId} was not found.`);
    }

    return mapCourseCatalogRows({
      institutionProfile: institutionProfile.rows[0],
      catalogProfile: catalogProfile.rows[0],
      academicYears: academicYears.rows,
      academicPeriods: academicPeriods.rows,
      subdivisions: subdivisions.rows,
      courses: courses.rows,
      sections: sections.rows,
      prerequisites: prerequisites.rows,
      lmsMappings: lmsMappings.rows,
    });
  }
}
