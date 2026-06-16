import { AcademyDataset, AdminUser, CourseSection, FacultyRecord, Program, StudentRecord } from "@/modules/academy-data/types";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { getDatabasePool } from "@/lib/database";
import type { QueryResultRow } from "pg";
import { InstitutionProfile } from "@/modules/academy-config/types";
import { mapAcademicCalendarRows } from "@/modules/academic-calendar/postgres-repository";
import { mapCourseCatalogRows } from "@/modules/course-catalog/postgres-repository";
import { mapGradingRecordsRows } from "@/modules/grading-records/postgres-repository";
import { mapPeopleRows } from "@/modules/people/postgres-repository";

export interface AcademyDatasetDatabase {
  query(text: string, values?: unknown[]): Promise<{
    rowCount: number | null;
    rows: QueryResultRow[];
  }>;
}

function parseArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === "string") {
    return JSON.parse(value) as T[];
  }

  return [];
}

function parseJson<T>(value: unknown): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value as T;
}

export class AcademyDataRepository {
  constructor(
    private readonly database: AcademyDatasetDatabase = getDatabasePool(),
  ) {}

  async loadDataset(tenantId: string): Promise<AcademyDataset> {
    const pool = this.database;
    const institutionProfiles = await pool.query("select * from academy_institution_profiles where tenant_id = $1 limit 1", [tenantId]);
    const calendarProfiles = await pool.query("select * from academy_calendar_profiles where tenant_id = $1 limit 1", [tenantId]);
    const academicYears = await pool.query("select * from academy_academic_years where tenant_id = $1 order by starts_on asc", [tenantId]);
    const academicPeriods = await pool.query("select * from academy_academic_periods where tenant_id = $1 order by sequence asc, starts_on asc", [tenantId]);
    const enrollmentWindows = await pool.query("select * from academy_enrollment_windows where tenant_id = $1 order by opens_at asc", [tenantId]);
    const gradingWindows = await pool.query("select * from academy_grading_windows where tenant_id = $1 order by opens_at asc", [tenantId]);
    const transcriptPeriods = await pool.query("select * from academy_transcript_periods where tenant_id = $1 order by posting_opens_at asc", [tenantId]);
    const subdivisions = await pool.query("select * from academy_institution_subdivisions where tenant_id = $1 order by subdivision_type asc, name asc", [tenantId]);
    const courseCatalogProfiles = await pool.query("select * from academy_course_catalog_profiles where tenant_id = $1 limit 1", [tenantId]);
    const catalogCourses = await pool.query("select * from academy_courses where tenant_id = $1 order by code asc", [tenantId]);
    const catalogSections = await pool.query("select * from academy_course_sections where tenant_id = $1 order by section_code asc", [tenantId]);
    const coursePrerequisites = await pool.query("select * from academy_course_prerequisites where tenant_id = $1 order by course_id asc", [tenantId]);
    const courseLmsMappings = await pool.query("select * from academy_course_lms_mappings where tenant_id = $1 order by mapping_status asc, provider asc", [tenantId]);
    const gradingProfiles = await pool.query("select * from academy_grading_profiles where tenant_id = $1 limit 1", [tenantId]);
    const evaluationScales = await pool.query("select * from academy_evaluation_scales where tenant_id = $1 order by scale_type asc, name asc", [tenantId]);
    const evaluationScaleBands = await pool.query("select * from academy_evaluation_scale_bands where tenant_id = $1 order by scale_id asc, sequence asc", [tenantId]);
    const evaluationRuleSets = await pool.query("select * from academy_evaluation_rule_sets where tenant_id = $1 order by course_id asc, record_type asc", [tenantId]);
    const officialRecordRules = await pool.query("select * from academy_official_record_rules where tenant_id = $1 order by record_type asc", [tenantId]);
    const academicStandingRules = await pool.query("select * from academy_academic_standing_rules where tenant_id = $1 order by standing_type asc, name asc", [tenantId]);
    const people = await pool.query("select * from academy_people where tenant_id = $1 order by display_name asc", [tenantId]);
    const roleAssignments = await pool.query("select * from academy_person_role_assignments where tenant_id = $1 order by person_id asc, role asc", [tenantId]);
    const studentProfiles = await pool.query("select * from academy_student_profiles where tenant_id = $1 order by student_number asc", [tenantId]);
    const staffProfiles = await pool.query("select * from academy_staff_profiles where tenant_id = $1 order by staff_number asc", [tenantId]);
    const relationships = await pool.query("select * from academy_student_relationships where tenant_id = $1 order by student_person_id asc, relationship_type asc", [tenantId]);
    const accountLinks = await pool.query("select * from academy_account_links where tenant_id = $1 order by provider asc, external_subject asc", [tenantId]);
    const admins = await pool.query("select * from academy_admin_users where tenant_id = $1 order by name asc", [tenantId]);
    const programs = await pool.query("select * from academy_programs where tenant_id = $1 order by name asc", [tenantId]);
    const students = await pool.query("select * from academy_students where tenant_id = $1 order by full_name asc", [tenantId]);
    const faculty = await pool.query("select * from academy_faculty where tenant_id = $1 order by name asc", [tenantId]);
    const sections = await pool.query("select * from academy_sections where tenant_id = $1 order by code asc", [tenantId]);
    const thresholds = await pool.query("select * from academy_thresholds where tenant_id = $1 limit 1", [tenantId]);

    if (thresholds.rowCount === 0) {
      throw new Error("Academy dataset is not seeded.");
    }

    if (institutionProfiles.rowCount === 0) {
      throw new Error("Academy institution profile is not seeded.");
    }

    if (calendarProfiles.rowCount === 0) {
      throw new Error("Academy academic calendar is not seeded.");
    }

    if (courseCatalogProfiles.rowCount === 0) {
      throw new Error("Academy course catalog is not seeded.");
    }

    if (gradingProfiles.rowCount === 0) {
      throw new Error("Academy grading records configuration is not seeded.");
    }

    const institutionProfile = institutionProfiles.rows[0];
    const academicCalendar = mapAcademicCalendarRows({
      institutionProfile,
      calendarProfile: calendarProfiles.rows[0],
      academicYears: academicYears.rows,
      periods: academicPeriods.rows,
      enrollmentWindows: enrollmentWindows.rows,
      gradingWindows: gradingWindows.rows,
      transcriptPeriods: transcriptPeriods.rows,
      subdivisions: subdivisions.rows,
    });
    const courseCatalog = mapCourseCatalogRows({
      institutionProfile,
      catalogProfile: courseCatalogProfiles.rows[0],
      academicYears: academicYears.rows,
      academicPeriods: academicPeriods.rows,
      subdivisions: subdivisions.rows,
      courses: catalogCourses.rows,
      sections: catalogSections.rows,
      prerequisites: coursePrerequisites.rows,
      lmsMappings: courseLmsMappings.rows,
    });
    const gradingRecords = mapGradingRecordsRows({
      institutionProfile,
      gradingProfile: gradingProfiles.rows[0],
      scales: evaluationScales.rows,
      scaleBands: evaluationScaleBands.rows,
      ruleSets: evaluationRuleSets.rows,
      officialRecordRules: officialRecordRules.rows,
      standingRules: academicStandingRules.rows,
    });
    const peopleConfiguration = mapPeopleRows({
      institutionProfile,
      people: people.rows,
      roleAssignments: roleAssignments.rows,
      studentProfiles: studentProfiles.rows,
      staffProfiles: staffProfiles.rows,
      relationships: relationships.rows,
      accountLinks: accountLinks.rows,
    });

    return {
      tenantId: thresholds.rows[0].tenant_id,
      productArea: "academy",
      generatedAt: new Date().toISOString(),
      institutionName: "ChurchCore Academy",
      institutionProfile: {
        tenantId: institutionProfile.tenant_id,
        institutionName: institutionProfile.institution_name,
        legalName: institutionProfile.legal_name,
        primaryMode: institutionProfile.primary_mode,
        supportedModes: parseArray<InstitutionProfile["supportedModes"][number]>(institutionProfile.supported_modes),
        operatingRules: parseJson<InstitutionProfile["operatingRules"]>(institutionProfile.operating_rules),
        capabilities: parseJson<InstitutionProfile["capabilities"]>(institutionProfile.capabilities),
        lmsPreference: parseJson<InstitutionProfile["lmsPreference"]>(institutionProfile.lms_preference),
        createdAt: institutionProfile.created_at.toISOString(),
        updatedAt: institutionProfile.updated_at.toISOString(),
      },
      academicCalendar,
      courseCatalog,
      gradingRecords,
      peopleConfiguration,
      administrators: admins.rows.map(
        (row): AdminUser => ({
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          title: row.title,
          role: row.role,
        }),
      ),
      programs: programs.rows.map(
        (row): Program => ({
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          credential: row.credential,
          requiredCredits: row.required_credits,
          cohortLabel: row.cohort_label,
        }),
      ),
      students: students.rows.map(
        (row): StudentRecord => ({
          id: row.id,
          tenantId: row.tenant_id,
          fullName: row.full_name,
          email: row.email,
          enrollmentStatus: row.enrollment_status,
          applicationStartedAt: row.application_started_at?.toISOString(),
          admittedAt: row.admitted_at?.toISOString(),
          activeTerm: row.active_term ?? undefined,
          programId: row.program_id ?? undefined,
          advisorUserId: row.advisor_user_id ?? undefined,
          missingEnrollmentSteps: parseArray<string>(row.missing_enrollment_steps),
          missingDocuments: parseArray<StudentRecord["missingDocuments"][number]>(row.missing_documents),
          documentationNotes: parseArray<string>(row.documentation_notes),
          creditsEarned: row.credits_earned,
          expectedCreditsByNow: row.expected_credits_by_now,
          transcriptCredits: row.transcript_credits,
          gpa: row.gpa === null ? undefined : Number(row.gpa),
          statusFlag: row.status_flag,
          allProgramCoursesCompleted: row.all_program_courses_completed,
          graduationAdministrativeHolds: parseArray<string>(row.graduation_administrative_holds),
          expectedNextTermRegistered: row.expected_next_term_registered,
          transcriptAlerts: parseArray<string>(row.transcript_alerts),
          recordAlerts: parseArray<string>(row.record_alerts),
        }),
      ),
      faculty: faculty.rows.map(
        (row): FacultyRecord => ({
          id: row.id,
          tenantId: row.tenant_id,
          name: row.name,
          title: row.title,
          assignedSectionIds: parseArray<string>(row.assigned_section_ids),
          adviseeCount: row.advisee_count,
        }),
      ),
      sections: sections.rows.map(
        (row): CourseSection => ({
          id: row.id,
          tenantId: row.tenant_id,
          code: row.code,
          title: row.title,
          programId: row.program_id,
          instructorFacultyId: row.instructor_faculty_id ?? undefined,
          rosterCount: row.roster_count,
          rosterCapacity: row.roster_capacity,
          setupAlerts: parseArray<string>(row.setup_alerts),
        }),
      ),
      thresholds: {
        incompleteEnrollmentDays: thresholds.rows[0].incomplete_enrollment_days,
        graduationCreditThreshold: Number(thresholds.rows[0].graduation_credit_threshold),
        creditPaceGap: thresholds.rows[0].credit_pace_gap,
        minimumGpa: Number(thresholds.rows[0].minimum_gpa),
        facultyLoadThreshold: thresholds.rows[0].faculty_load_threshold,
        advisorStudentRatioThreshold: thresholds.rows[0].advisor_student_ratio_threshold,
      },
    };
  }

  async seedFromMockData(dataset: AcademyDataset = academyDataset) {
    const pool = this.database;

    await pool.query("begin");
    try {
      await pool.query(
        `insert into academy_institution_profiles (
           tenant_id, institution_name, legal_name, primary_mode, supported_modes, operating_rules, capabilities, lms_preference, created_at, updated_at
         )
         values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
         on conflict (tenant_id) do update
         set institution_name = excluded.institution_name,
             legal_name = excluded.legal_name,
             primary_mode = excluded.primary_mode,
             supported_modes = excluded.supported_modes,
             operating_rules = excluded.operating_rules,
             capabilities = excluded.capabilities,
             lms_preference = excluded.lms_preference,
             updated_at = excluded.updated_at`,
        [
          dataset.institutionProfile.tenantId,
          dataset.institutionProfile.institutionName,
          dataset.institutionProfile.legalName,
          dataset.institutionProfile.primaryMode,
          JSON.stringify(dataset.institutionProfile.supportedModes),
          JSON.stringify(dataset.institutionProfile.operatingRules),
          JSON.stringify(dataset.institutionProfile.capabilities),
          JSON.stringify(dataset.institutionProfile.lmsPreference),
          dataset.institutionProfile.createdAt,
          dataset.institutionProfile.updatedAt,
        ],
      );

      await pool.query(
        `insert into academy_calendar_profiles (
           tenant_id, calendar_system, default_term_structure, timezone, week_starts_on,
           uses_instructional_days, uses_enrollment_windows, uses_grading_windows, uses_transcript_periods,
           created_at, updated_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (tenant_id) do update
         set calendar_system = excluded.calendar_system,
             default_term_structure = excluded.default_term_structure,
             timezone = excluded.timezone,
             week_starts_on = excluded.week_starts_on,
             uses_instructional_days = excluded.uses_instructional_days,
             uses_enrollment_windows = excluded.uses_enrollment_windows,
             uses_grading_windows = excluded.uses_grading_windows,
             uses_transcript_periods = excluded.uses_transcript_periods,
             updated_at = excluded.updated_at`,
        [
          dataset.academicCalendar.calendarProfile.tenantId,
          dataset.academicCalendar.calendarProfile.calendarSystem,
          dataset.academicCalendar.calendarProfile.defaultTermStructure,
          dataset.academicCalendar.calendarProfile.timezone,
          dataset.academicCalendar.calendarProfile.weekStartsOn,
          dataset.academicCalendar.calendarProfile.usesInstructionalDays,
          dataset.academicCalendar.calendarProfile.usesEnrollmentWindows,
          dataset.academicCalendar.calendarProfile.usesGradingWindows,
          dataset.academicCalendar.calendarProfile.usesTranscriptPeriods,
          dataset.academicCalendar.calendarProfile.createdAt,
          dataset.academicCalendar.calendarProfile.updatedAt,
        ],
      );

      for (const subdivision of dataset.academicCalendar.subdivisions) {
        await pool.query(
          `insert into academy_institution_subdivisions (
             id, tenant_id, parent_subdivision_id, name, code, subdivision_type, institution_mode, status, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               parent_subdivision_id = excluded.parent_subdivision_id,
               name = excluded.name,
               code = excluded.code,
               subdivision_type = excluded.subdivision_type,
               institution_mode = excluded.institution_mode,
               status = excluded.status,
               updated_at = excluded.updated_at`,
          [
            subdivision.id,
            subdivision.tenantId,
            subdivision.parentSubdivisionId ?? null,
            subdivision.name,
            subdivision.code,
            subdivision.subdivisionType,
            subdivision.institutionMode ?? null,
            subdivision.status,
            subdivision.createdAt,
            subdivision.updatedAt,
          ],
        );
      }

      for (const academicYear of dataset.academicCalendar.academicYears) {
        await pool.query(
          `insert into academy_academic_years (
             id, tenant_id, name, code, starts_on, ends_on, status, calendar_system, subdivision_id, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               name = excluded.name,
               code = excluded.code,
               starts_on = excluded.starts_on,
               ends_on = excluded.ends_on,
               status = excluded.status,
               calendar_system = excluded.calendar_system,
               subdivision_id = excluded.subdivision_id,
               updated_at = excluded.updated_at`,
          [
            academicYear.id,
            academicYear.tenantId,
            academicYear.name,
            academicYear.code,
            academicYear.startsOn,
            academicYear.endsOn,
            academicYear.status,
            academicYear.calendarSystem,
            academicYear.subdivisionId ?? null,
            academicYear.createdAt,
            academicYear.updatedAt,
          ],
        );
      }

      for (const period of dataset.academicCalendar.periods) {
        await pool.query(
          `insert into academy_academic_periods (
             id, tenant_id, academic_year_id, parent_period_id, subdivision_id, name, code,
             period_type, starts_on, ends_on, sequence, status, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               academic_year_id = excluded.academic_year_id,
               parent_period_id = excluded.parent_period_id,
               subdivision_id = excluded.subdivision_id,
               name = excluded.name,
               code = excluded.code,
               period_type = excluded.period_type,
               starts_on = excluded.starts_on,
               ends_on = excluded.ends_on,
               sequence = excluded.sequence,
               status = excluded.status,
               updated_at = excluded.updated_at`,
          [
            period.id,
            period.tenantId,
            period.academicYearId,
            period.parentPeriodId ?? null,
            period.subdivisionId ?? null,
            period.name,
            period.code,
            period.periodType,
            period.startsOn,
            period.endsOn,
            period.sequence,
            period.status,
            period.createdAt,
            period.updatedAt,
          ],
        );
      }

      for (const window of dataset.academicCalendar.enrollmentWindows) {
        await pool.query(
          `insert into academy_enrollment_windows (
             id, tenant_id, academic_period_id, window_type, opens_at, closes_at,
             applies_to_subdivision_id, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               academic_period_id = excluded.academic_period_id,
               window_type = excluded.window_type,
               opens_at = excluded.opens_at,
               closes_at = excluded.closes_at,
               applies_to_subdivision_id = excluded.applies_to_subdivision_id,
               updated_at = excluded.updated_at`,
          [
            window.id,
            window.tenantId,
            window.academicPeriodId,
            window.windowType,
            window.opensAt,
            window.closesAt ?? null,
            window.appliesToSubdivisionId ?? null,
            window.createdAt,
            window.updatedAt,
          ],
        );
      }

      for (const window of dataset.academicCalendar.gradingWindows) {
        await pool.query(
          `insert into academy_grading_windows (
             id, tenant_id, academic_period_id, opens_at, closes_at, grade_posting_policy, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               academic_period_id = excluded.academic_period_id,
               opens_at = excluded.opens_at,
               closes_at = excluded.closes_at,
               grade_posting_policy = excluded.grade_posting_policy,
               updated_at = excluded.updated_at`,
          [
            window.id,
            window.tenantId,
            window.academicPeriodId,
            window.opensAt,
            window.closesAt,
            window.gradePostingPolicy,
            window.createdAt,
            window.updatedAt,
          ],
        );
      }

      for (const period of dataset.academicCalendar.transcriptPeriods) {
        await pool.query(
          `insert into academy_transcript_periods (
             id, tenant_id, academic_period_id, record_type, posting_opens_at, posting_closes_at, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               academic_period_id = excluded.academic_period_id,
               record_type = excluded.record_type,
               posting_opens_at = excluded.posting_opens_at,
               posting_closes_at = excluded.posting_closes_at,
               updated_at = excluded.updated_at`,
          [
            period.id,
            period.tenantId,
            period.academicPeriodId,
            period.recordType,
            period.postingOpensAt,
            period.postingClosesAt,
            period.createdAt,
            period.updatedAt,
          ],
        );
      }

      await pool.query(
        `insert into academy_course_catalog_profiles (
           tenant_id, default_course_record_type, default_duration_unit, supports_credits, supports_clock_hours,
           supports_competencies, supports_narrative_evaluation, supports_grade_levels, supports_lms_mapping,
           created_at, updated_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (tenant_id) do update
         set default_course_record_type = excluded.default_course_record_type,
             default_duration_unit = excluded.default_duration_unit,
             supports_credits = excluded.supports_credits,
             supports_clock_hours = excluded.supports_clock_hours,
             supports_competencies = excluded.supports_competencies,
             supports_narrative_evaluation = excluded.supports_narrative_evaluation,
             supports_grade_levels = excluded.supports_grade_levels,
             supports_lms_mapping = excluded.supports_lms_mapping,
             updated_at = excluded.updated_at`,
        [
          dataset.courseCatalog.catalogProfile.tenantId,
          dataset.courseCatalog.catalogProfile.defaultCourseRecordType,
          dataset.courseCatalog.catalogProfile.defaultDurationUnit,
          dataset.courseCatalog.catalogProfile.supportsCredits,
          dataset.courseCatalog.catalogProfile.supportsClockHours,
          dataset.courseCatalog.catalogProfile.supportsCompetencies,
          dataset.courseCatalog.catalogProfile.supportsNarrativeEvaluation,
          dataset.courseCatalog.catalogProfile.supportsGradeLevels,
          dataset.courseCatalog.catalogProfile.supportsLmsMapping,
          dataset.courseCatalog.catalogProfile.createdAt,
          dataset.courseCatalog.catalogProfile.updatedAt,
        ],
      );

      for (const course of dataset.courseCatalog.courses) {
        await pool.query(
          `insert into academy_courses (
             id, tenant_id, code, title, description, course_type, course_level, record_type, default_duration,
             default_credits, default_clock_hours, default_competency_set_id, owning_subdivision_id,
             grade_band_subdivision_id, status, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               code = excluded.code,
               title = excluded.title,
               description = excluded.description,
               course_type = excluded.course_type,
               course_level = excluded.course_level,
               record_type = excluded.record_type,
               default_duration = excluded.default_duration,
               default_credits = excluded.default_credits,
               default_clock_hours = excluded.default_clock_hours,
               default_competency_set_id = excluded.default_competency_set_id,
               owning_subdivision_id = excluded.owning_subdivision_id,
               grade_band_subdivision_id = excluded.grade_band_subdivision_id,
               status = excluded.status,
               updated_at = excluded.updated_at`,
          [
            course.id,
            course.tenantId,
            course.code,
            course.title,
            course.description,
            course.courseType,
            course.courseLevel,
            course.recordType,
            JSON.stringify(course.defaultDuration),
            course.defaultCredits ?? null,
            course.defaultClockHours ?? null,
            course.defaultCompetencySetId ?? null,
            course.owningSubdivisionId ?? null,
            course.gradeBandSubdivisionId ?? null,
            course.status,
            course.createdAt,
            course.updatedAt,
          ],
        );
      }

      for (const section of dataset.courseCatalog.sections) {
        await pool.query(
          `insert into academy_course_sections (
             id, tenant_id, course_id, academic_year_id, academic_period_id, subdivision_id, section_code,
             title_override, delivery_mode, schedule_pattern, capacity, status, primary_instructor_role,
             primary_instructor_id, assistant_instructor_ids, lms_mapping_id, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               course_id = excluded.course_id,
               academic_year_id = excluded.academic_year_id,
               academic_period_id = excluded.academic_period_id,
               subdivision_id = excluded.subdivision_id,
               section_code = excluded.section_code,
               title_override = excluded.title_override,
               delivery_mode = excluded.delivery_mode,
               schedule_pattern = excluded.schedule_pattern,
               capacity = excluded.capacity,
               status = excluded.status,
               primary_instructor_role = excluded.primary_instructor_role,
               primary_instructor_id = excluded.primary_instructor_id,
               assistant_instructor_ids = excluded.assistant_instructor_ids,
               lms_mapping_id = excluded.lms_mapping_id,
               updated_at = excluded.updated_at`,
          [
            section.id,
            section.tenantId,
            section.courseId,
            section.academicYearId,
            section.academicPeriodId,
            section.subdivisionId ?? null,
            section.sectionCode,
            section.titleOverride ?? null,
            section.deliveryMode,
            section.schedulePattern ?? null,
            section.capacity ?? null,
            section.status,
            section.primaryInstructorRole,
            section.primaryInstructorId ?? null,
            JSON.stringify(section.assistantInstructorIds),
            section.lmsMappingId ?? null,
            section.createdAt,
            section.updatedAt,
          ],
        );
      }

      for (const prerequisite of dataset.courseCatalog.prerequisites) {
        await pool.query(
          `insert into academy_course_prerequisites (
             id, tenant_id, course_id, required_course_id, requirement_type, minimum_grade_rule_id, notes, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               course_id = excluded.course_id,
               required_course_id = excluded.required_course_id,
               requirement_type = excluded.requirement_type,
               minimum_grade_rule_id = excluded.minimum_grade_rule_id,
               notes = excluded.notes,
               updated_at = excluded.updated_at`,
          [
            prerequisite.id,
            prerequisite.tenantId,
            prerequisite.courseId,
            prerequisite.requiredCourseId,
            prerequisite.requirementType,
            prerequisite.minimumGradeRuleId ?? null,
            prerequisite.notes ?? null,
            prerequisite.createdAt,
            prerequisite.updatedAt,
          ],
        );
      }

      for (const mapping of dataset.courseCatalog.lmsMappings) {
        await pool.query(
          `insert into academy_course_lms_mappings (
             id, tenant_id, course_id, section_id, provider, mapping_status, external_course_key,
             external_section_key, sync_policy, last_reviewed_at, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               course_id = excluded.course_id,
               section_id = excluded.section_id,
               provider = excluded.provider,
               mapping_status = excluded.mapping_status,
               external_course_key = excluded.external_course_key,
               external_section_key = excluded.external_section_key,
               sync_policy = excluded.sync_policy,
               last_reviewed_at = excluded.last_reviewed_at,
               updated_at = excluded.updated_at`,
          [
            mapping.id,
            mapping.tenantId,
            mapping.courseId ?? null,
            mapping.sectionId ?? null,
            mapping.provider,
            mapping.mappingStatus,
            mapping.externalCourseKey ?? null,
            mapping.externalSectionKey ?? null,
            mapping.syncPolicy,
            mapping.lastReviewedAt ?? null,
            mapping.createdAt,
            mapping.updatedAt,
          ],
        );
      }

      await pool.query(
        `insert into academy_grading_profiles (
           tenant_id, default_evaluation_type, default_official_record_type, supports_gpa, supports_credits,
           supports_clock_hours, supports_competencies, supports_narrative_evaluation, supports_promotion,
           supports_graduation_audit, grade_release_policy, guardian_visibility_policy, created_at, updated_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         on conflict (tenant_id) do update
         set default_evaluation_type = excluded.default_evaluation_type,
             default_official_record_type = excluded.default_official_record_type,
             supports_gpa = excluded.supports_gpa,
             supports_credits = excluded.supports_credits,
             supports_clock_hours = excluded.supports_clock_hours,
             supports_competencies = excluded.supports_competencies,
             supports_narrative_evaluation = excluded.supports_narrative_evaluation,
             supports_promotion = excluded.supports_promotion,
             supports_graduation_audit = excluded.supports_graduation_audit,
             grade_release_policy = excluded.grade_release_policy,
             guardian_visibility_policy = excluded.guardian_visibility_policy,
             updated_at = excluded.updated_at`,
        [
          dataset.gradingRecords.gradingProfile.tenantId,
          dataset.gradingRecords.gradingProfile.defaultEvaluationType,
          dataset.gradingRecords.gradingProfile.defaultOfficialRecordType,
          dataset.gradingRecords.gradingProfile.supportsGpa,
          dataset.gradingRecords.gradingProfile.supportsCredits,
          dataset.gradingRecords.gradingProfile.supportsClockHours,
          dataset.gradingRecords.gradingProfile.supportsCompetencies,
          dataset.gradingRecords.gradingProfile.supportsNarrativeEvaluation,
          dataset.gradingRecords.gradingProfile.supportsPromotion,
          dataset.gradingRecords.gradingProfile.supportsGraduationAudit,
          dataset.gradingRecords.gradingProfile.gradeReleasePolicy,
          dataset.gradingRecords.gradingProfile.guardianVisibilityPolicy,
          dataset.gradingRecords.gradingProfile.createdAt,
          dataset.gradingRecords.gradingProfile.updatedAt,
        ],
      );

      for (const scale of dataset.gradingRecords.scales) {
        await pool.query(
          `insert into academy_evaluation_scales (
             id, tenant_id, name, scale_type, applies_to_record_type, narrative_required, status, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               name = excluded.name,
               scale_type = excluded.scale_type,
               applies_to_record_type = excluded.applies_to_record_type,
               narrative_required = excluded.narrative_required,
               status = excluded.status,
               updated_at = excluded.updated_at`,
          [
            scale.id,
            scale.tenantId,
            scale.name,
            scale.scaleType,
            scale.appliesToRecordType,
            scale.narrativeRequired ?? null,
            scale.status,
            scale.createdAt,
            scale.updatedAt,
          ],
        );
      }

      for (const band of dataset.gradingRecords.scaleBands) {
        await pool.query(
          `insert into academy_evaluation_scale_bands (
             id, tenant_id, scale_id, label, minimum_value, maximum_value, grade_points,
             is_passing, is_completion, official_record_value, sequence
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               scale_id = excluded.scale_id,
               label = excluded.label,
               minimum_value = excluded.minimum_value,
               maximum_value = excluded.maximum_value,
               grade_points = excluded.grade_points,
               is_passing = excluded.is_passing,
               is_completion = excluded.is_completion,
               official_record_value = excluded.official_record_value,
               sequence = excluded.sequence`,
          [
            band.id,
            band.tenantId,
            band.scaleId,
            band.label,
            band.minimumValue ?? null,
            band.maximumValue ?? null,
            band.gradePoints ?? null,
            band.isPassing,
            band.isCompletion,
            band.officialRecordValue,
            band.sequence,
          ],
        );
      }

      for (const ruleSet of dataset.gradingRecords.ruleSets) {
        await pool.query(
          `insert into academy_evaluation_rule_sets (
             id, tenant_id, course_id, section_id, evaluation_type, scale_id, record_type, gpa_policy,
             credit_policy, clock_hour_policy, competency_policy, narrative_policy, posting_policy,
             lms_grade_return_policy, status, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               course_id = excluded.course_id,
               section_id = excluded.section_id,
               evaluation_type = excluded.evaluation_type,
               scale_id = excluded.scale_id,
               record_type = excluded.record_type,
               gpa_policy = excluded.gpa_policy,
               credit_policy = excluded.credit_policy,
               clock_hour_policy = excluded.clock_hour_policy,
               competency_policy = excluded.competency_policy,
               narrative_policy = excluded.narrative_policy,
               posting_policy = excluded.posting_policy,
               lms_grade_return_policy = excluded.lms_grade_return_policy,
               status = excluded.status,
               updated_at = excluded.updated_at`,
          [
            ruleSet.id,
            ruleSet.tenantId,
            ruleSet.courseId,
            ruleSet.sectionId ?? null,
            ruleSet.evaluationType,
            ruleSet.scaleId,
            ruleSet.recordType,
            ruleSet.gpaPolicy,
            ruleSet.creditPolicy,
            ruleSet.clockHourPolicy,
            ruleSet.competencyPolicy,
            ruleSet.narrativePolicy,
            ruleSet.postingPolicy,
            ruleSet.lmsGradeReturnPolicy,
            ruleSet.status,
            ruleSet.createdAt,
            ruleSet.updatedAt,
          ],
        );
      }

      for (const rule of dataset.gradingRecords.officialRecordRules) {
        await pool.query(
          `insert into academy_official_record_rules (
             id, tenant_id, record_type, applies_to_institution_mode, posting_authority, release_policy,
             included_in_transcript, included_in_progress_report, included_in_completion_record,
             included_in_promotion, included_in_graduation_audit, status
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               record_type = excluded.record_type,
               applies_to_institution_mode = excluded.applies_to_institution_mode,
               posting_authority = excluded.posting_authority,
               release_policy = excluded.release_policy,
               included_in_transcript = excluded.included_in_transcript,
               included_in_progress_report = excluded.included_in_progress_report,
               included_in_completion_record = excluded.included_in_completion_record,
               included_in_promotion = excluded.included_in_promotion,
               included_in_graduation_audit = excluded.included_in_graduation_audit,
               status = excluded.status`,
          [
            rule.id,
            rule.tenantId,
            rule.recordType,
            rule.appliesToInstitutionMode,
            rule.postingAuthority,
            rule.releasePolicy,
            rule.includedInTranscript,
            rule.includedInProgressReport,
            rule.includedInCompletionRecord,
            rule.includedInPromotion,
            rule.includedInGraduationAudit,
            rule.status,
          ],
        );
      }

      for (const rule of dataset.gradingRecords.standingRules) {
        await pool.query(
          `insert into academy_academic_standing_rules (
             id, tenant_id, name, standing_type, applies_to_institution_mode, minimum_gpa,
             minimum_credits_earned, minimum_clock_hours, required_competencies,
             required_completion_records, promotion_criteria, graduation_criteria, status
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               name = excluded.name,
               standing_type = excluded.standing_type,
               applies_to_institution_mode = excluded.applies_to_institution_mode,
               minimum_gpa = excluded.minimum_gpa,
               minimum_credits_earned = excluded.minimum_credits_earned,
               minimum_clock_hours = excluded.minimum_clock_hours,
               required_competencies = excluded.required_competencies,
               required_completion_records = excluded.required_completion_records,
               promotion_criteria = excluded.promotion_criteria,
               graduation_criteria = excluded.graduation_criteria,
               status = excluded.status`,
          [
            rule.id,
            rule.tenantId,
            rule.name,
            rule.standingType,
            rule.appliesToInstitutionMode,
            rule.minimumGpa ?? null,
            rule.minimumCreditsEarned ?? null,
            rule.minimumClockHours ?? null,
            JSON.stringify(rule.requiredCompetencies ?? []),
            JSON.stringify(rule.requiredCompletionRecords ?? []),
            rule.promotionCriteria ?? null,
            rule.graduationCriteria ?? null,
            rule.status,
          ],
        );
      }

      for (const person of dataset.peopleConfiguration.people) {
        await pool.query(
          `insert into academy_people (
             id, tenant_id, display_name, given_name, family_name, preferred_name, email, phone,
             date_of_birth, person_status, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               display_name = excluded.display_name,
               given_name = excluded.given_name,
               family_name = excluded.family_name,
               preferred_name = excluded.preferred_name,
               email = excluded.email,
               phone = excluded.phone,
               date_of_birth = excluded.date_of_birth,
               person_status = excluded.person_status,
               updated_at = excluded.updated_at`,
          [
            person.id,
            person.tenantId,
            person.displayName,
            person.givenName ?? null,
            person.familyName ?? null,
            person.preferredName ?? null,
            person.email ?? null,
            person.phone ?? null,
            person.dateOfBirth ?? null,
            person.personStatus,
            person.createdAt,
            person.updatedAt,
          ],
        );
      }

      for (const assignment of dataset.peopleConfiguration.roleAssignments) {
        await pool.query(
          `insert into academy_person_role_assignments (
             id, tenant_id, person_id, role, scope_type, scope_id, status, starts_on, ends_on, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               person_id = excluded.person_id,
               role = excluded.role,
               scope_type = excluded.scope_type,
               scope_id = excluded.scope_id,
               status = excluded.status,
               starts_on = excluded.starts_on,
               ends_on = excluded.ends_on,
               updated_at = excluded.updated_at`,
          [
            assignment.id,
            assignment.tenantId,
            assignment.personId,
            assignment.role,
            assignment.scopeType,
            assignment.scopeId ?? null,
            assignment.status,
            assignment.startsOn ?? null,
            assignment.endsOn ?? null,
            assignment.createdAt,
            assignment.updatedAt,
          ],
        );
      }

      for (const profile of dataset.peopleConfiguration.studentProfiles) {
        await pool.query(
          `insert into academy_student_profiles (
             id, tenant_id, person_id, student_number, student_type, enrollment_status,
             primary_subdivision_id, grade_band_subdivision_id, program_id, advisor_person_id,
             guardian_required, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               person_id = excluded.person_id,
               student_number = excluded.student_number,
               student_type = excluded.student_type,
               enrollment_status = excluded.enrollment_status,
               primary_subdivision_id = excluded.primary_subdivision_id,
               grade_band_subdivision_id = excluded.grade_band_subdivision_id,
               program_id = excluded.program_id,
               advisor_person_id = excluded.advisor_person_id,
               guardian_required = excluded.guardian_required,
               updated_at = excluded.updated_at`,
          [
            profile.id,
            profile.tenantId,
            profile.personId,
            profile.studentNumber,
            profile.studentType,
            profile.enrollmentStatus,
            profile.primarySubdivisionId ?? null,
            profile.gradeBandSubdivisionId ?? null,
            profile.programId ?? null,
            profile.advisorPersonId ?? null,
            profile.guardianRequired,
            profile.createdAt,
            profile.updatedAt,
          ],
        );
      }

      for (const profile of dataset.peopleConfiguration.staffProfiles) {
        await pool.query(
          `insert into academy_staff_profiles (
             id, tenant_id, person_id, staff_number, title, primary_role, primary_subdivision_id,
             employment_status, load_policy, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               person_id = excluded.person_id,
               staff_number = excluded.staff_number,
               title = excluded.title,
               primary_role = excluded.primary_role,
               primary_subdivision_id = excluded.primary_subdivision_id,
               employment_status = excluded.employment_status,
               load_policy = excluded.load_policy,
               updated_at = excluded.updated_at`,
          [
            profile.id,
            profile.tenantId,
            profile.personId,
            profile.staffNumber,
            profile.title,
            profile.primaryRole,
            profile.primarySubdivisionId ?? null,
            profile.employmentStatus,
            profile.loadPolicy ?? null,
            profile.createdAt,
            profile.updatedAt,
          ],
        );
      }

      for (const relationship of dataset.peopleConfiguration.relationships) {
        await pool.query(
          `insert into academy_student_relationships (
             id, tenant_id, student_person_id, related_person_id, relationship_type, authority,
             visibility, status, starts_on, ends_on, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               student_person_id = excluded.student_person_id,
               related_person_id = excluded.related_person_id,
               relationship_type = excluded.relationship_type,
               authority = excluded.authority,
               visibility = excluded.visibility,
               status = excluded.status,
               starts_on = excluded.starts_on,
               ends_on = excluded.ends_on,
               updated_at = excluded.updated_at`,
          [
            relationship.id,
            relationship.tenantId,
            relationship.studentPersonId,
            relationship.relatedPersonId,
            relationship.relationshipType,
            relationship.authority,
            relationship.visibility,
            relationship.status,
            relationship.startsOn ?? null,
            relationship.endsOn ?? null,
            relationship.createdAt,
            relationship.updatedAt,
          ],
        );
      }

      for (const accountLink of dataset.peopleConfiguration.accountLinks) {
        await pool.query(
          `insert into academy_account_links (
             id, tenant_id, person_id, provider, external_subject, status, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               person_id = excluded.person_id,
               provider = excluded.provider,
               external_subject = excluded.external_subject,
               status = excluded.status,
               updated_at = excluded.updated_at`,
          [
            accountLink.id,
            accountLink.tenantId,
            accountLink.personId,
            accountLink.provider,
            accountLink.externalSubject,
            accountLink.status,
            accountLink.createdAt,
            accountLink.updatedAt,
          ],
        );
      }

      await pool.query(
        `insert into public.academy_gradebook_assignments (
           id, tenant_id, course_id, section_id, created_by_person_id, title, description,
           assignment_type, max_points, weight, due_date, is_published, sensitivity_tier,
           created_at, updated_at
         ) values
           (
             '11111111-1111-4111-8111-111111111111',
             'cca-main',
             'course-reading-k5',
             'section-reading-k5',
             'person-sophia-marsh',
             'Reading Fluency Reflection',
             'Teacher-reviewed reading reflection for the demo grade entry queue.',
             'reflection',
             100,
             1.0,
             '2026-09-12T21:00:00.000Z',
             true,
             'standard',
             '2026-06-16T00:00:00.000Z',
             '2026-06-16T00:00:00.000Z'
           ),
           (
             '22222222-2222-4222-8222-222222222222',
             'cca-main',
             'course-reading-k5',
             'section-reading-k5',
             'person-sophia-marsh',
             'Pastoral Encouragement Journal',
             'Pastoral-sensitive learner reflection used to verify growth-framed grade display.',
             'reflection',
             100,
             1.0,
             '2026-09-19T21:00:00.000Z',
             true,
             'pastoral',
             '2026-06-16T00:00:00.000Z',
             '2026-06-16T00:00:00.000Z'
           )
         on conflict (id) do update
         set course_id = excluded.course_id,
             section_id = excluded.section_id,
             created_by_person_id = excluded.created_by_person_id,
             title = excluded.title,
             description = excluded.description,
             assignment_type = excluded.assignment_type,
             max_points = excluded.max_points,
             weight = excluded.weight,
             due_date = excluded.due_date,
             is_published = excluded.is_published,
             sensitivity_tier = excluded.sensitivity_tier,
             updated_at = excluded.updated_at`,
      );

      await pool.query(
        `insert into public.academy_gradebook_submissions (
           id, tenant_id, assignment_id, learner_person_id, submitted_at, content, status, created_at, updated_at
         ) values
           (
             '33333333-3333-4333-8333-333333333333',
             'cca-main',
             '11111111-1111-4111-8111-111111111111',
             'person-lena-rivera',
             '2026-09-10T18:00:00.000Z',
             'Lena reads the assigned passage and reflects on one growth step.',
             'submitted',
             '2026-06-16T00:00:00.000Z',
             '2026-06-16T00:00:00.000Z'
           ),
           (
             '44444444-4444-4444-8444-444444444444',
             'cca-main',
             '22222222-2222-4222-8222-222222222222',
             'person-lena-rivera',
             '2026-09-17T18:00:00.000Z',
             'Lena shares a pastoral encouragement reflection.',
             'graded',
             '2026-06-16T00:00:00.000Z',
             '2026-06-16T00:00:00.000Z'
           )
         on conflict (id) do update
         set assignment_id = excluded.assignment_id,
             learner_person_id = excluded.learner_person_id,
             submitted_at = excluded.submitted_at,
             content = excluded.content,
             status = excluded.status,
             updated_at = excluded.updated_at`,
      );

      await pool.query(
        `insert into public.academy_gradebook_records (
           id, tenant_id, submission_id, assignment_id, learner_person_id, graded_by_person_id,
           points_earned, max_points, letter_grade, is_passing, instructor_feedback,
           sensitivity_tier, graded_at, created_at, updated_at
         ) values (
           '55555555-5555-4555-8555-555555555555',
           'cca-main',
           '44444444-4444-4444-8444-444444444444',
           '22222222-2222-4222-8222-222222222222',
           'person-lena-rivera',
           'person-sophia-marsh',
           88,
           100,
           'B+',
           true,
           'Lena is showing steady growth and should keep practicing reflective detail.',
           'pastoral',
           '2026-09-18T14:00:00.000Z',
           '2026-06-16T00:00:00.000Z',
           '2026-06-16T00:00:00.000Z'
         )
         on conflict (tenant_id, submission_id) do update
         set graded_by_person_id = excluded.graded_by_person_id,
             points_earned = excluded.points_earned,
             max_points = excluded.max_points,
             letter_grade = excluded.letter_grade,
             is_passing = excluded.is_passing,
             instructor_feedback = excluded.instructor_feedback,
             sensitivity_tier = excluded.sensitivity_tier,
             graded_at = excluded.graded_at,
             updated_at = excluded.updated_at`,
      );

      for (const admin of dataset.administrators) {
        await pool.query(
          `insert into academy_admin_users (id, tenant_id, name, title, role)
           values ($1, $2, $3, $4, $5)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id, name = excluded.name, title = excluded.title, role = excluded.role`,
          [admin.id, admin.tenantId, admin.name, admin.title, admin.role],
        );
      }

      for (const program of dataset.programs) {
        await pool.query(
          `insert into academy_programs (id, tenant_id, name, credential, required_credits, cohort_label)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id, name = excluded.name, credential = excluded.credential,
               required_credits = excluded.required_credits, cohort_label = excluded.cohort_label`,
          [program.id, program.tenantId, program.name, program.credential, program.requiredCredits, program.cohortLabel],
        );
      }

      for (const student of dataset.students) {
        await pool.query(
          `insert into academy_students (
             id, tenant_id, full_name, email, enrollment_status, application_started_at, admitted_at, active_term,
             program_id, advisor_user_id, missing_enrollment_steps, missing_documents, documentation_notes,
             credits_earned, expected_credits_by_now, transcript_credits, gpa, status_flag,
             all_program_courses_completed, graduation_administrative_holds, expected_next_term_registered,
             transcript_alerts, record_alerts
           )
           values (
             $1, $2, $3, $4, $5, $6, $7, $8,
             $9, $10, $11::jsonb, $12::jsonb, $13::jsonb,
             $14, $15, $16, $17, $18,
             $19, $20::jsonb, $21,
             $22::jsonb, $23::jsonb
           )
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               full_name = excluded.full_name,
               email = excluded.email,
               enrollment_status = excluded.enrollment_status,
               application_started_at = excluded.application_started_at,
               admitted_at = excluded.admitted_at,
               active_term = excluded.active_term,
               program_id = excluded.program_id,
               advisor_user_id = excluded.advisor_user_id,
               missing_enrollment_steps = excluded.missing_enrollment_steps,
               missing_documents = excluded.missing_documents,
               documentation_notes = excluded.documentation_notes,
               credits_earned = excluded.credits_earned,
               expected_credits_by_now = excluded.expected_credits_by_now,
               transcript_credits = excluded.transcript_credits,
               gpa = excluded.gpa,
               status_flag = excluded.status_flag,
               all_program_courses_completed = excluded.all_program_courses_completed,
               graduation_administrative_holds = excluded.graduation_administrative_holds,
               expected_next_term_registered = excluded.expected_next_term_registered,
               transcript_alerts = excluded.transcript_alerts,
               record_alerts = excluded.record_alerts`,
          [
            student.id,
            student.tenantId,
            student.fullName,
            student.email,
            student.enrollmentStatus,
            student.applicationStartedAt ?? null,
            student.admittedAt ?? null,
            student.activeTerm ?? null,
            student.programId ?? null,
            student.advisorUserId ?? null,
            JSON.stringify(student.missingEnrollmentSteps),
            JSON.stringify(student.missingDocuments),
            JSON.stringify(student.documentationNotes),
            student.creditsEarned,
            student.expectedCreditsByNow,
            student.transcriptCredits,
            student.gpa ?? null,
            student.statusFlag,
            student.allProgramCoursesCompleted,
            JSON.stringify(student.graduationAdministrativeHolds),
            student.expectedNextTermRegistered,
            JSON.stringify(student.transcriptAlerts),
            JSON.stringify(student.recordAlerts),
          ],
        );
      }

      for (const faculty of dataset.faculty) {
        await pool.query(
          `insert into academy_faculty (id, tenant_id, name, title, assigned_section_ids, advisee_count)
           values ($1, $2, $3, $4, $5::jsonb, $6)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               name = excluded.name,
               title = excluded.title,
               assigned_section_ids = excluded.assigned_section_ids,
               advisee_count = excluded.advisee_count`,
          [faculty.id, faculty.tenantId, faculty.name, faculty.title, JSON.stringify(faculty.assignedSectionIds), faculty.adviseeCount],
        );
      }

      for (const section of dataset.sections) {
        await pool.query(
          `insert into academy_sections (id, tenant_id, code, title, program_id, instructor_faculty_id, roster_count, roster_capacity, setup_alerts)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
           on conflict (id) do update
           set tenant_id = excluded.tenant_id,
               code = excluded.code,
               title = excluded.title,
               program_id = excluded.program_id,
               instructor_faculty_id = excluded.instructor_faculty_id,
               roster_count = excluded.roster_count,
               roster_capacity = excluded.roster_capacity,
               setup_alerts = excluded.setup_alerts`,
          [
            section.id,
            section.tenantId,
            section.code,
            section.title,
            section.programId,
            section.instructorFacultyId ?? null,
            section.rosterCount,
            section.rosterCapacity,
            JSON.stringify(section.setupAlerts),
          ],
        );
      }

      await pool.query(
        `insert into academy_thresholds (
           tenant_id,
           incomplete_enrollment_days,
           graduation_credit_threshold,
           credit_pace_gap,
           minimum_gpa,
           faculty_load_threshold,
           advisor_student_ratio_threshold
         )
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (tenant_id) do update
         set incomplete_enrollment_days = excluded.incomplete_enrollment_days,
             graduation_credit_threshold = excluded.graduation_credit_threshold,
             credit_pace_gap = excluded.credit_pace_gap,
             minimum_gpa = excluded.minimum_gpa,
             faculty_load_threshold = excluded.faculty_load_threshold,
             advisor_student_ratio_threshold = excluded.advisor_student_ratio_threshold`,
        [
          dataset.tenantId,
          dataset.thresholds.incompleteEnrollmentDays,
          dataset.thresholds.graduationCreditThreshold,
          dataset.thresholds.creditPaceGap,
          dataset.thresholds.minimumGpa,
          dataset.thresholds.facultyLoadThreshold,
          dataset.thresholds.advisorStudentRatioThreshold,
        ],
      );

      await pool.query("commit");
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  }
}
