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

export interface CourseCatalogRepository {
  fetchCourseCatalogConfiguration(tenantId: string): Promise<CourseCatalogConfiguration>;
  findCourseById(courseId: string): Promise<Course | null>;
  findCourseByCode(tenantId: string, code: string): Promise<Course | null>;
  createCourse(input: {
    tenantId: string;
    code: string;
    title: string;
    description: string;
    courseType: Course["courseType"];
    courseLevel: Course["courseLevel"];
    recordType: Course["recordType"];
    defaultCredits?: number;
    defaultClockHours?: number;
    owningSubdivisionId?: string;
    prerequisiteIds: string[];
    status: Course["status"];
  }): Promise<Course>;
  updateCourse(
    courseId: string,
    updates: {
      title?: string;
      description?: string;
      defaultCredits?: number;
      defaultClockHours?: number;
      owningSubdivisionId?: string;
      prerequisiteIds?: string[];
      status?: Course["status"];
    },
  ): Promise<Course>;
  findActiveSectionsByCourseId(courseId: string): Promise<CourseSection[]>;
  createSection(input: {
    tenantId: string;
    courseId: string;
    academicPeriodId: string;
    sectionCode: string;
    deliveryMode: CourseSection["deliveryMode"];
    capacity?: number;
    primaryInstructorId?: string;
    schedulePattern?: string;
    subdivisionId?: string;
    status: CourseSection["status"];
  }): Promise<CourseSection>;
  findSectionById(sectionId: string): Promise<CourseSection | null>;
  findSectionByCodeAndPeriod(
    courseId: string,
    periodId: string,
    sectionCode: string,
  ): Promise<CourseSection | null>;
  updateSection(
    sectionId: string,
    updates: {
      capacity?: number;
      primaryInstructorId?: string;
      schedulePattern?: string;
      status?: CourseSection["status"];
    },
  ): Promise<CourseSection>;
  getEnrollmentCount(sectionId: string): Promise<number>;
  fetchPrerequisites(tenantId: string): Promise<CoursePrerequisite[]>;
  fetchPrerequisitesByCourseId(courseId: string): Promise<CoursePrerequisite[]>;
  fetchCompletedCourseIds(studentPersonId: string): Promise<string[]>;
  listCourses(
    tenantId: string,
    filters?: { subdivisionId?: string; includeArchived?: boolean },
  ): Promise<Course[]>;
  listSectionsByCourseId(courseId: string): Promise<CourseSection[]>;
}

export class AcademyCourseCatalogRepository implements CourseCatalogRepository {
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

  async findCourseById(courseId: string): Promise<Course | null> {
    const result = await this.pool.query(
      "select * from academy_courses where id = $1",
      [courseId],
    );
    return result.rowCount ? mapCourseRow(result.rows[0]) : null;
  }

  async findCourseByCode(tenantId: string, code: string): Promise<Course | null> {
    const result = await this.pool.query(
      "select * from academy_courses where tenant_id = $1 and code = $2",
      [tenantId, code],
    );
    return result.rowCount ? mapCourseRow(result.rows[0]) : null;
  }

  async createCourse(input: {
    tenantId: string;
    code: string;
    title: string;
    description: string;
    courseType: Course["courseType"];
    courseLevel: Course["courseLevel"];
    recordType: Course["recordType"];
    defaultCredits?: number;
    defaultClockHours?: number;
    owningSubdivisionId?: string;
    prerequisiteIds: string[];
    status: Course["status"];
  }): Promise<Course> {
    const result = await this.pool.query(
      `insert into academy_courses (
        id, tenant_id, code, title, description, course_type, course_level, record_type,
        default_duration, default_credits, default_clock_hours, owning_subdivision_id, status,
        created_at, updated_at
      ) values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
      returning *`,
      [
        input.tenantId,
        input.code,
        input.title,
        input.description,
        input.courseType,
        input.courseLevel,
        input.recordType,
        JSON.stringify({
          durationUnit: input.defaultCredits ? "credit_hour" : "clock_hour",
          durationValue: input.defaultCredits ?? input.defaultClockHours ?? 0,
          creditHours: input.defaultCredits,
          clockHours: input.defaultClockHours,
        }),
        input.defaultCredits,
        input.defaultClockHours,
        input.owningSubdivisionId,
        input.status,
      ],
    );

    const course = mapCourseRow(result.rows[0]);

    // Insert prerequisites
    if (input.prerequisiteIds.length > 0) {
      for (const prereqId of input.prerequisiteIds) {
        await this.pool.query(
          `insert into academy_course_prerequisites (
            id, tenant_id, course_id, required_course_id, requirement_type, created_at, updated_at
          ) values (gen_random_uuid()::text, $1, $2, $3, $4, now(), now())`,
          [input.tenantId, course.id, prereqId, "required_before_registration"],
        );
      }
    }

    return course;
  }

  async updateCourse(
    courseId: string,
    updates: {
      title?: string;
      description?: string;
      defaultCredits?: number;
      defaultClockHours?: number;
      owningSubdivisionId?: string;
      prerequisiteIds?: string[];
      status?: Course["status"];
    },
  ): Promise<Course> {
    const course = await this.findCourseById(courseId);
    if (!course) {
      throw new Error("Course not found.");
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.defaultCredits !== undefined) {
      fields.push(`default_credits = $${paramIndex++}`);
      values.push(updates.defaultCredits);
    }
    if (updates.defaultClockHours !== undefined) {
      fields.push(`default_clock_hours = $${paramIndex++}`);
      values.push(updates.defaultClockHours);
    }
    if (updates.owningSubdivisionId !== undefined) {
      fields.push(`owning_subdivision_id = $${paramIndex++}`);
      values.push(updates.owningSubdivisionId);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (fields.length > 0) {
      fields.push(`updated_at = now()`);
      values.push(courseId);
      const result = await this.pool.query(
        `update academy_courses set ${fields.join(", ")} where id = $${paramIndex} returning *`,
        values,
      );
      if (result.rowCount === 0) {
        throw new Error("Course not found.");
      }
    }

    // Update prerequisites if provided
    if (updates.prerequisiteIds !== undefined) {
      await this.pool.query(
        "delete from academy_course_prerequisites where course_id = $1",
        [courseId],
      );
      for (const prereqId of updates.prerequisiteIds) {
        await this.pool.query(
          `insert into academy_course_prerequisites (
            id, tenant_id, course_id, required_course_id, requirement_type, created_at, updated_at
          ) values (gen_random_uuid()::text, $1, $2, $3, $4, now(), now())`,
          [course.tenantId, courseId, prereqId, "required_before_registration"],
        );
      }
    }

    return (await this.findCourseById(courseId))!;
  }

  async findActiveSectionsByCourseId(courseId: string): Promise<CourseSection[]> {
    const result = await this.pool.query(
      `select * from academy_course_sections
       where course_id = $1 and status in ('scheduled', 'open', 'in_progress')`,
      [courseId],
    );
    return result.rows.map(mapSectionRow);
  }

  async createSection(input: {
    tenantId: string;
    courseId: string;
    academicYearId: string;
    academicPeriodId: string;
    sectionCode: string;
    deliveryMode: CourseSection["deliveryMode"];
    capacity?: number;
    primaryInstructorId?: string;
    schedulePattern?: string;
    subdivisionId?: string;
    status: CourseSection["status"];
  }): Promise<CourseSection> {
    const result = await this.pool.query(
      `insert into academy_course_sections (
        id, tenant_id, course_id, academic_period_id, section_code,
        delivery_mode, capacity, primary_instructor_role, primary_instructor_id,
        schedule_pattern, subdivision_id, assistant_instructor_ids, status,
        created_at, updated_at
      ) values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
      returning *`,
      [
        input.tenantId,
        input.courseId,
        input.academicPeriodId,
        input.sectionCode,
        input.deliveryMode,
        input.capacity,
        "instructor",
        input.primaryInstructorId,
        input.schedulePattern,
        input.subdivisionId,
        JSON.stringify([]),
        input.status,
      ],
    );
    return mapSectionRow(result.rows[0]);
  }

  async findSectionById(sectionId: string): Promise<CourseSection | null> {
    const result = await this.pool.query(
      "select * from academy_course_sections where id = $1",
      [sectionId],
    );
    return result.rowCount ? mapSectionRow(result.rows[0]) : null;
  }

  async findSectionByCodeAndPeriod(
    courseId: string,
    periodId: string,
    sectionCode: string,
  ): Promise<CourseSection | null> {
    const result = await this.pool.query(
      `select * from academy_course_sections
       where course_id = $1 and academic_period_id = $2 and section_code = $3`,
      [courseId, periodId, sectionCode],
    );
    return result.rowCount ? mapSectionRow(result.rows[0]) : null;
  }

  async updateSection(
    sectionId: string,
    updates: {
      capacity?: number;
      primaryInstructorId?: string;
      schedulePattern?: string;
      status?: CourseSection["status"];
    },
  ): Promise<CourseSection> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.capacity !== undefined) {
      fields.push(`capacity = $${paramIndex++}`);
      values.push(updates.capacity);
    }
    if (updates.primaryInstructorId !== undefined) {
      fields.push(`primary_instructor_id = $${paramIndex++}`);
      values.push(updates.primaryInstructorId);
    }
    if (updates.schedulePattern !== undefined) {
      fields.push(`schedule_pattern = $${paramIndex++}`);
      values.push(updates.schedulePattern);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (fields.length > 0) {
      fields.push(`updated_at = now()`);
      values.push(sectionId);
      const result = await this.pool.query(
        `update academy_course_sections set ${fields.join(", ")} where id = $${paramIndex} returning *`,
        values,
      );
      if (result.rowCount === 0) {
        throw new Error("Section not found.");
      }
      return mapSectionRow(result.rows[0]);
    }

    return (await this.findSectionById(sectionId))!;
  }

  async getEnrollmentCount(sectionId: string): Promise<number> {
    const result = await this.pool.query(
      `select count(*) as count from academy_course_section_registrations
       where course_section_id = $1 and status = 'registered'`,
      [sectionId],
    );
    return Number(result.rows[0].count);
  }

  async fetchPrerequisites(tenantId: string): Promise<CoursePrerequisite[]> {
    const result = await this.pool.query(
      "select * from academy_course_prerequisites where tenant_id = $1",
      [tenantId],
    );
    return result.rows.map(mapPrerequisiteRow);
  }

  async fetchPrerequisitesByCourseId(courseId: string): Promise<CoursePrerequisite[]> {
    const result = await this.pool.query(
      "select * from academy_course_prerequisites where course_id = $1",
      [courseId],
    );
    return result.rows.map(mapPrerequisiteRow);
  }

  async fetchCompletedCourseIds(studentPersonId: string): Promise<string[]> {
    const result = await this.pool.query(
      `select distinct cs.course_id
       from academy_course_section_registrations r
       join academy_course_sections cs on cs.id = r.course_section_id
       join academy_transcript_records tr on tr.registration_id = r.id
       where r.student_person_id = $1
         and r.status = 'registered'
         and tr.is_posted = true
         and tr.transcript_released = true`,
      [studentPersonId],
    );
    return result.rows.map((row) => String(row.course_id));
  }

  async listCourses(
    tenantId: string,
    filters?: { subdivisionId?: string; includeArchived?: boolean },
  ): Promise<Course[]> {
    let sql = "select * from academy_courses where tenant_id = $1";
    const values: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.subdivisionId) {
      sql += ` and owning_subdivision_id = $${paramIndex++}`;
      values.push(filters.subdivisionId);
    }

    if (!filters?.includeArchived) {
      sql += " and status != 'archived'";
    }

    sql += " order by code asc";

    const result = await this.pool.query(sql, values);
    return result.rows.map(mapCourseRow);
  }

  async listSectionsByCourseId(courseId: string): Promise<CourseSection[]> {
    const result = await this.pool.query(
      "select * from academy_course_sections where course_id = $1 order by section_code asc",
      [courseId],
    );
    return result.rows.map(mapSectionRow);
  }
}
