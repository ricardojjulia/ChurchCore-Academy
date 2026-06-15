import { getDatabasePool } from "@/lib/database";
import {
  ConvertedAdmissionRecord,
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
