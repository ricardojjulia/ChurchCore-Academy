import { getDatabasePool } from "@/lib/database";
import {
  ConvertedAdmissionRecord,
  CourseSectionRegistrationEligibility,
  CourseRegistrationRepository,
  CourseRegistrationRequest,
  CourseRegistrationResult,
} from "@/modules/course-registration/types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface CourseRegistrationDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function asIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapResult(row: Record<string, unknown>): CourseRegistrationResult {
  return {
    registrationId: String(row.registration_id),
    applicationId: String(row.application_id),
    studentProfileId: String(row.student_profile_id),
    studentPersonId: String(row.student_person_id),
    courseSectionId: String(row.course_section_id),
    programEnrollmentId: String(row.program_enrollment_id),
    periodRegistrationId: String(row.period_registration_id),
    registeredAt: asIso(row.registered_at),
    confirmedAt: asIso(row.confirmed_at),
    idempotencyKey: String(row.idempotency_key),
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}

function asInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapEligibility(
  row: Record<string, unknown>,
): CourseSectionRegistrationEligibility {
  return {
    courseSectionId: String(row.course_section_id),
    academicPeriodId: String(row.academic_period_id),
    status: String(row.status),
    capacity: asNullableInteger(row.capacity),
    activeRegistrationCount: asInteger(row.active_registration_count),
    hasActiveRegistrationForStudent: Boolean(row.has_active_registration_for_student),
    registrationWindowOpen: Boolean(row.registration_window_open),
    unmetPrerequisites: asStringArray(row.unmet_prerequisites),
    activeHolds: asStringArray(row.active_holds),
  };
}

export class PostgresCourseRegistrationRepository
  implements CourseRegistrationRepository
{
  constructor(
    private readonly database: CourseRegistrationDatabase = getDatabasePool(),
  ) {}

  async findConvertedAdmission(
    tenantId: string,
    applicationId: string,
  ): Promise<ConvertedAdmissionRecord | undefined> {
    const result = await this.database.query(
      `select application.tenant_id,
              application.id as application_id,
              application.status,
              application.student_profile_id,
              application.program_enrollment_id,
              application.period_registration_id,
              enrollment.student_person_id
         from academy_admission_applications application
         left join academy_program_enrollments enrollment
           on enrollment.tenant_id = application.tenant_id
          and enrollment.id = application.program_enrollment_id
        where application.tenant_id = $1 and application.id = $2`,
      [tenantId, applicationId],
    );

    if (!result.rows[0]) {
      return undefined;
    }

    const row = result.rows[0];
    return {
      tenantId: String(row.tenant_id),
      applicationId: String(row.application_id),
      status: String(row.status) as ConvertedAdmissionRecord["status"],
      studentProfileId:
        row.student_profile_id === null || row.student_profile_id === undefined
          ? undefined
          : String(row.student_profile_id),
      programEnrollmentId:
        row.program_enrollment_id === null || row.program_enrollment_id === undefined
          ? undefined
          : String(row.program_enrollment_id),
      periodRegistrationId:
        row.period_registration_id === null || row.period_registration_id === undefined
          ? undefined
          : String(row.period_registration_id),
      studentPersonId:
        row.student_person_id === null || row.student_person_id === undefined
          ? undefined
          : String(row.student_person_id),
    };
  }

  async findReplay(tenantId: string, idempotencyKey: string) {
    const result = await this.database.query(
      `select registration.id as registration_id,
              registration.source_application_id as application_id,
              registration.student_profile_id,
              registration.student_person_id,
              registration.course_section_id,
              registration.program_enrollment_id,
              registration.period_registration_id,
              registration.registered_at,
              registration.confirmed_at,
              registration.idempotency_key
         from academy_course_section_registrations registration
        where registration.tenant_id = $1 and registration.idempotency_key = $2`,
      [tenantId, idempotencyKey],
    );

    return result.rows[0] ? mapResult(result.rows[0]) : undefined;
  }

  async evaluateSectionEligibility(input: {
    tenantId: string;
    courseSectionId: string;
    studentPersonId: string;
    periodRegistrationId: string;
    evaluatedAt: string;
  }) {
    const result = await this.database.query(
      `with target_section as (
         select section.id,
                section.academic_period_id,
                section.course_id,
                section.capacity,
                section.status
           from academy_course_sections section
           join academy_period_registrations period_registration
             on period_registration.tenant_id = section.tenant_id
            and period_registration.id = $4
            and period_registration.academic_period_id = section.academic_period_id
          where section.tenant_id = $1
            and section.id = $2
        ),
        active_registrations as (
          select count(*)::int as active_registration_count
            from academy_course_section_registrations registration
           where registration.tenant_id = $1
             and registration.course_section_id = $2
             and registration.status in ('pending_confirmation', 'registered')
        ),
        duplicate_registration as (
          select exists (
            select 1
              from academy_course_section_registrations registration
             where registration.tenant_id = $1
               and registration.student_person_id = $3
               and registration.course_section_id = $2
               and registration.status in ('pending_confirmation', 'registered', 'waitlisted')
          ) as has_active_registration_for_student
        ),
        open_window as (
          select exists (
            select 1
              from academy_enrollment_windows enrollment_window
              join target_section section
                on section.academic_period_id = enrollment_window.academic_period_id
             where enrollment_window.tenant_id = $1
               and enrollment_window.window_type in ('registration', 'add_drop')
               and enrollment_window.opens_at <= $5::timestamptz
               and (
                 enrollment_window.closes_at is null
                 or enrollment_window.closes_at >= $5::timestamptz
               )
          ) as registration_window_open
        ),
        unmet_prerequisites as (
          select coalesce(
            array_agg(prerequisite.required_course_id order by prerequisite.required_course_id)
              filter (where prerequisite.required_course_id is not null),
            array[]::text[]
          ) as unmet_prerequisites
            from target_section section
            join academy_course_prerequisites prerequisite
              on prerequisite.tenant_id = $1
             and prerequisite.course_id = section.course_id
            left join academy_course_section_registrations completed_registration
              on completed_registration.tenant_id = $1
             and completed_registration.student_person_id = $3
             and completed_registration.status = 'completed'
            left join academy_course_sections completed_section
              on completed_section.tenant_id = completed_registration.tenant_id
             and completed_section.id = completed_registration.course_section_id
             and completed_section.course_id = prerequisite.required_course_id
           where completed_section.id is null
        )
        select section.id as course_section_id,
               section.academic_period_id,
               section.status,
               section.capacity,
               active_registrations.active_registration_count,
               duplicate_registration.has_active_registration_for_student,
               open_window.registration_window_open,
               unmet_prerequisites.unmet_prerequisites,
               array[]::text[] as active_holds
          from target_section section
         cross join active_registrations
         cross join duplicate_registration
         cross join open_window
         cross join unmet_prerequisites`,
      [
        input.tenantId,
        input.courseSectionId,
        input.studentPersonId,
        input.periodRegistrationId,
        input.evaluatedAt,
      ],
    );

    if (!result.rows[0]) {
      throw new Error(
        "Course section eligibility failed: section and period registration must share the same academic period.",
      );
    }

    return mapEligibility(result.rows[0]);
  }

  async createRegistration(
    input: CourseRegistrationRequest,
    admission: {
      studentProfileId: string;
      programEnrollmentId: string;
      periodRegistrationId: string;
      studentPersonId: string;
    },
  ) {
    const registrationResult = await this.database.query(
      `insert into academy_course_section_registrations (
         tenant_id,
         student_profile_id,
         student_person_id,
         program_enrollment_id,
         period_registration_id,
         course_section_id,
         source_application_id,
         status,
         registered_at,
         confirmed_at,
         confirmation_note,
         idempotency_key
       )
       select
         $1,
         $2,
         $3,
         $4,
         $5,
         section.id,
         $6,
         'registered',
         now(),
         $7,
         $8,
         $9
       from academy_course_sections section
       join academy_period_registrations period_registration
         on period_registration.tenant_id = $1
        and period_registration.id = $5
       where section.tenant_id = $1
         and section.id = $10
         and section.academic_period_id = period_registration.academic_period_id
       returning id as registration_id,
                 source_application_id as application_id,
                 student_profile_id,
                 student_person_id,
                 course_section_id,
                 program_enrollment_id,
                 period_registration_id,
                 registered_at,
                 confirmed_at,
                 idempotency_key`,
      [
        input.tenantId,
        admission.studentProfileId,
        admission.studentPersonId,
        admission.programEnrollmentId,
        admission.periodRegistrationId,
        input.applicationId,
        input.confirmedAt,
        input.confirmationNote ?? null,
        input.idempotencyKey,
        input.courseSectionId,
      ],
    );

    if (!registrationResult.rows[0]) {
      throw new Error(
        "Course section registration failed: section and period registration must share the same academic period.",
      );
    }

    const row = registrationResult.rows[0];

    await this.database.query(
      `insert into academy_enrollment_confirmation_events (
         tenant_id,
         course_section_registration_id,
         application_id,
         actor_person_id,
         event_type,
         correlation_id,
         idempotency_key,
         redacted_metadata
       ) values (
         $1,
         $2,
         $3,
         $4,
         'confirmed',
         $5,
         $6,
         $7::jsonb
       )`,
      [
        input.tenantId,
        row.registration_id,
        input.applicationId,
        input.actorPersonId,
        input.correlationId,
        input.idempotencyKey,
        JSON.stringify({
          courseSectionId: input.courseSectionId,
          confirmationNotePresent: Boolean(input.confirmationNote),
        }),
      ],
    );

    return mapResult(row);
  }
}
