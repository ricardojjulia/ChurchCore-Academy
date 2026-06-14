import { getDatabasePool } from "@/lib/database";
import { mapAdmissionApplicationRow } from "@/modules/admissions/postgres-repository";
import {
  EnrollmentConversionInput,
  EnrollmentConversionResult,
} from "@/modules/enrollment-conversion/types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface EnrollmentConversionDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapConversionRow(
  row: Record<string, unknown>,
): EnrollmentConversionResult {
  return {
    applicationId: String(row.application_id),
    studentProfileId: String(row.student_profile_id),
    studentNumber: String(row.student_number),
    programEnrollmentId: String(row.program_enrollment_id),
    periodRegistrationId: String(row.period_registration_id),
    convertedAt: iso(row.occurred_at ?? row.converted_at),
    idempotencyKey: String(row.idempotency_key),
  };
}

export class PostgresEnrollmentConversionRepository {
  constructor(
    private readonly database: EnrollmentConversionDatabase =
      getDatabasePool(),
  ) {}

  async findApplication(tenantId: string, applicationId: string) {
    const result = await this.database.query(
      `select application.*, profile.student_number
       from academy_admission_applications application
       left join academy_student_profiles profile
         on profile.tenant_id = application.tenant_id
        and profile.id = application.student_profile_id
       where application.tenant_id = $1 and application.id = $2`,
      [tenantId, applicationId],
    );
    return result.rows[0]
      ? mapAdmissionApplicationRow(result.rows[0])
      : undefined;
  }

  async findReplay(tenantId: string, idempotencyKey: string) {
    const result = await this.database.query(
      `select application_id, student_profile_id, student_number,
              program_enrollment_id, period_registration_id,
              occurred_at, idempotency_key
       from academy_enrollment_conversion_events
       where tenant_id = $1 and idempotency_key = $2`,
      [tenantId, idempotencyKey],
    );
    return result.rows[0] ? mapConversionRow(result.rows[0]) : undefined;
  }

  async findResultByApplication(
    tenantId: string,
    applicationId: string,
  ) {
    const result = await this.database.query(
      `select application_id, student_profile_id, student_number,
              program_enrollment_id, period_registration_id,
              occurred_at, idempotency_key
       from academy_enrollment_conversion_events
       where tenant_id = $1 and application_id = $2`,
      [tenantId, applicationId],
    );
    return result.rows[0] ? mapConversionRow(result.rows[0]) : undefined;
  }

  async convert(
    input: EnrollmentConversionInput,
  ): Promise<EnrollmentConversionResult> {
    const replay = await this.findReplay(
      input.tenantId,
      input.idempotencyKey,
    );
    if (replay) {
      return replay;
    }

    const applicationResult = await this.database.query(
      `select id, applicant_person_id, program_id, application_term_id,
              status, converted_at
       from academy_admission_applications
       where tenant_id = $1 and id = $2
       for update`,
      [input.tenantId, input.applicationId],
    );
    const application = applicationResult.rows[0];
    if (!application) {
      throw new Error(
        `Admission application ${input.applicationId} was not found.`,
      );
    }
    if (application.status !== "accepted") {
      throw new Error("Only accepted applications can be converted.");
    }
    if (!application.application_term_id) {
      throw new Error(
        "Assign an application term before converting this application.",
      );
    }
    if (application.converted_at) {
      throw new Error("Admission application is already converted.");
    }

    const sequenceResult = await this.database.query(
      `insert into academy_student_number_sequences (
         tenant_id, next_value, updated_at
       ) values ($1, 2, now())
       on conflict (tenant_id) do update
       set next_value = academy_student_number_sequences.next_value + 1,
           updated_at = now()
       returning next_value - 1 as allocated_value`,
      [input.tenantId],
    );
    const allocatedValue = Number(sequenceResult.rows[0].allocated_value);
    const studentNumber = `S-${String(allocatedValue).padStart(6, "0")}`;
    const personId = String(application.applicant_person_id);

    await this.database.query(
      `insert into academy_person_role_assignments (
         id, tenant_id, person_id, role, scope_type, scope_id, status,
         starts_on
       ) values (
         gen_random_uuid()::text, $1, $2, 'student', 'institution', $1,
         'active', current_date
       )
       on conflict do nothing`,
      [input.tenantId, personId],
    );

    const profileResult = await this.database.query(
      `insert into academy_student_profiles (
         id, tenant_id, person_id, student_number, student_type,
         enrollment_status, program_id
       ) values (
         gen_random_uuid()::text, $1, $2, $3, 'new', 'active', $4
       )
       returning id, student_number`,
      [
        input.tenantId,
        personId,
        studentNumber,
        String(application.program_id),
      ],
    );
    const profile = profileResult.rows[0];

    const programEnrollmentResult = await this.database.query(
      `insert into academy_program_enrollments (
         tenant_id, student_profile_id, student_person_id, program_id,
         source_application_id, status
       ) values ($1, $2, $3, $4, $5, 'active')
       returning id`,
      [
        input.tenantId,
        profile.id,
        personId,
        application.program_id,
        input.applicationId,
      ],
    );
    const programEnrollmentId = String(
      programEnrollmentResult.rows[0].id,
    );

    const periodRegistrationResult = await this.database.query(
      `insert into academy_period_registrations (
         tenant_id, student_profile_id, student_person_id,
         academic_period_id, program_enrollment_id, source_application_id,
         status
       ) values ($1, $2, $3, $4, $5, $6, 'registered')
       returning id`,
      [
        input.tenantId,
        profile.id,
        personId,
        application.application_term_id,
        programEnrollmentId,
        input.applicationId,
      ],
    );
    const periodRegistrationId = String(
      periodRegistrationResult.rows[0].id,
    );

    await this.database.query(
      `update academy_admission_applications
       set converted_at = $3,
           converted_by_person_id = $4,
           student_profile_id = $5,
           program_enrollment_id = $6,
           period_registration_id = $7,
           updated_at = now()
       where tenant_id = $1 and id = $2`,
      [
        input.tenantId,
        input.applicationId,
        input.convertedAt,
        input.actorPersonId,
        profile.id,
        programEnrollmentId,
        periodRegistrationId,
      ],
    );

    await this.database.query(
      `insert into academy_enrollment_conversion_events (
         tenant_id, application_id, actor_person_id, student_profile_id,
         student_number, program_enrollment_id, period_registration_id,
         correlation_id, idempotency_key, occurred_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        input.tenantId,
        input.applicationId,
        input.actorPersonId,
        profile.id,
        profile.student_number,
        programEnrollmentId,
        periodRegistrationId,
        input.correlationId,
        input.idempotencyKey,
        input.convertedAt,
      ],
    );

    return {
      applicationId: input.applicationId,
      studentProfileId: String(profile.id),
      studentNumber: String(profile.student_number),
      programEnrollmentId,
      periodRegistrationId,
      convertedAt: input.convertedAt,
      idempotencyKey: input.idempotencyKey,
    };
  }
}
