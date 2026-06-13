import { getDatabasePool } from "@/lib/database";
import {
  AdmissionApplication,
  AdmissionApplicationEventInput,
  AdmissionApplicationListFilters,
  AdmissionApplicationStatus,
  CreateAdmissionApplicationInput,
} from "@/modules/admissions/types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface AdmissionsDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function optionalIso(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : iso(value);
}

export function mapAdmissionApplicationRow(
  row: Record<string, unknown>,
): AdmissionApplication {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    applicantPersonId: String(row.applicant_person_id),
    programId: String(row.program_id),
    applicationTermId:
      row.application_term_id === null ||
      row.application_term_id === undefined
        ? undefined
        : String(row.application_term_id),
    legalName: String(row.legal_name),
    preferredName:
      row.preferred_name === null || row.preferred_name === undefined
        ? undefined
        : String(row.preferred_name),
    email: String(row.email),
    phone:
      row.phone === null || row.phone === undefined
        ? undefined
        : String(row.phone),
    status: row.status as AdmissionApplicationStatus,
    submittedAt: optionalIso(row.submitted_at),
    decidedAt: optionalIso(row.decided_at),
    decidedByPersonId:
      row.decided_by_person_id === null ||
      row.decided_by_person_id === undefined
        ? undefined
        : String(row.decided_by_person_id),
    decisionReason:
      row.decision_reason === null || row.decision_reason === undefined
        ? undefined
        : String(row.decision_reason),
    convertedAt: optionalIso(row.converted_at),
    convertedByPersonId:
      row.converted_by_person_id === null ||
      row.converted_by_person_id === undefined
        ? undefined
        : String(row.converted_by_person_id),
    studentProfileId:
      row.student_profile_id === null || row.student_profile_id === undefined
        ? undefined
        : String(row.student_profile_id),
    programEnrollmentId:
      row.program_enrollment_id === null ||
      row.program_enrollment_id === undefined
        ? undefined
        : String(row.program_enrollment_id),
    periodRegistrationId:
      row.period_registration_id === null ||
      row.period_registration_id === undefined
        ? undefined
        : String(row.period_registration_id),
    studentNumber:
      row.student_number === null || row.student_number === undefined
        ? undefined
        : String(row.student_number),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export class PostgresAdmissionsRepository {
  constructor(
    private readonly database: AdmissionsDatabase = getDatabasePool(),
  ) {}

  async findById(tenantId: string, applicationId: string) {
    const result = await this.database.query(
      `select *
       from academy_admission_applications
       where tenant_id = $1 and id = $2`,
      [tenantId, applicationId],
    );
    return result.rows[0]
      ? mapAdmissionApplicationRow(result.rows[0])
      : undefined;
  }

  async findByIdempotencyKey(tenantId: string, idempotencyKey: string) {
    const result = await this.database.query(
      `select *
       from academy_admission_applications
       where tenant_id = $1 and idempotency_key = $2`,
      [tenantId, idempotencyKey],
    );
    return result.rows[0]
      ? mapAdmissionApplicationRow(result.rows[0])
      : undefined;
  }

  async findMutationByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ) {
    const result = await this.database.query(
      `select application.*, event.event_type
       from academy_admission_application_events event
       join academy_admission_applications application
         on application.tenant_id = event.tenant_id
        and application.id = event.application_id
       where event.tenant_id = $1 and event.idempotency_key = $2`,
      [tenantId, idempotencyKey],
    );
    return result.rows[0]
      ? {
          application: mapAdmissionApplicationRow(result.rows[0]),
          eventType: result.rows[0].event_type as AdmissionApplicationEventInput["eventType"],
        }
      : undefined;
  }

  async list(
    tenantId: string,
    filters: AdmissionApplicationListFilters = {},
  ) {
    const conditions = ["tenant_id = $1"];
    const values: unknown[] = [tenantId];

    if (filters.status) {
      values.push(filters.status);
      conditions.push(`status = $${values.length}`);
    }
    if (filters.applicantPersonId) {
      values.push(filters.applicantPersonId);
      conditions.push(`applicant_person_id = $${values.length}`);
    }

    const result = await this.database.query(
      `select *
       from academy_admission_applications
       where ${conditions.join(" and ")}
       order by updated_at desc`,
      values,
    );
    return result.rows.map(mapAdmissionApplicationRow);
  }

  async create(
    input: CreateAdmissionApplicationInput,
    _actorPersonId: string,
    _correlationId: string,
    idempotencyKey: string,
  ) {
    const result = await this.database.query(
      `insert into academy_admission_applications (
         tenant_id, applicant_person_id, program_id, application_term_id,
         legal_name, preferred_name, email, phone, status, idempotency_key
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9)
       returning *`,
      [
        input.tenantId,
        input.applicantPersonId,
        input.programId,
        input.applicationTermId ?? null,
        input.legalName,
        input.preferredName ?? null,
        input.email,
        input.phone ?? null,
        idempotencyKey,
      ],
    );
    return mapAdmissionApplicationRow(result.rows[0]);
  }

  async transition(
    tenantId: string,
    applicationId: string,
    expectedStatus: AdmissionApplicationStatus,
    nextStatus: AdmissionApplicationStatus,
    decision?: {
      decidedAt: string;
      decidedByPersonId: string;
      decisionReason?: string;
    },
  ) {
    const submittedAt = nextStatus === "submitted" ? new Date().toISOString() : null;
    const result = await this.database.query(
      `update academy_admission_applications
       set status = $4,
           submitted_at = coalesce($5, submitted_at),
           decided_at = coalesce($6, decided_at),
           decided_by_person_id = coalesce($7, decided_by_person_id),
           decision_reason = coalesce($8, decision_reason),
           updated_at = now()
       where tenant_id = $1 and id = $2 and status = $3
       returning *`,
      [
        tenantId,
        applicationId,
        expectedStatus,
        nextStatus,
        submittedAt,
        decision?.decidedAt ?? null,
        decision?.decidedByPersonId ?? null,
        decision?.decisionReason ?? null,
      ],
    );
    return result.rows[0]
      ? mapAdmissionApplicationRow(result.rows[0])
      : undefined;
  }

  async appendEvent(event: AdmissionApplicationEventInput) {
    await this.database.query(
      `insert into academy_admission_application_events (
         tenant_id, application_id, actor_person_id, event_type,
         previous_status, next_status, redacted_notes, correlation_id,
         idempotency_key
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        event.tenantId,
        event.applicationId,
        event.actorPersonId,
        event.eventType,
        event.previousStatus ?? null,
        event.nextStatus,
        event.redactedNotes ?? null,
        event.correlationId ?? null,
        event.idempotencyKey,
      ],
    );
  }
}
