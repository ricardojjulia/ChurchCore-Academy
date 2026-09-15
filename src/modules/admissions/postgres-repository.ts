import { getDatabasePool } from "@/lib/database";
import {
  AdmissionApplication,
  AdmissionApplicationEventInput,
  AdmissionApplicationListFilters,
  AdmissionApplicationStatus,
  ApplicationDocument,
  ApplicationDocumentStatus,
  CreateAdmissionApplicationInput,
  CreateDocumentTypeInput,
  DocumentChecklistItem,
  DocumentType,
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
      `select application.*, profile.student_number
       from academy_admission_applications application
       left join academy_student_profiles profile
         on profile.tenant_id = application.tenant_id
        and profile.id = application.student_profile_id
       where ${conditions
         .map((condition) => `application.${condition}`)
         .join(" and ")}
       order by application.updated_at desc`,
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

  // Document type management

  async createDocumentType(input: CreateDocumentTypeInput): Promise<DocumentType> {
    const result = await this.database.query(
      `insert into academy_document_types (
         tenant_id, name, slug, required, description
       ) values ($1, $2, $3, $4, $5)
       returning *`,
      [
        input.tenantId,
        input.name,
        input.slug,
        input.required,
        input.description ?? null,
      ],
    );
    return mapDocumentTypeRow(result.rows[0]);
  }

  async findDocumentTypeById(tenantId: string, documentTypeId: string): Promise<DocumentType | undefined> {
    const result = await this.database.query(
      `select * from academy_document_types
       where tenant_id = $1 and id = $2`,
      [tenantId, documentTypeId],
    );
    return result.rows[0] ? mapDocumentTypeRow(result.rows[0]) : undefined;
  }

  async listActiveDocumentTypes(tenantId: string): Promise<DocumentType[]> {
    const result = await this.database.query(
      `select * from academy_document_types
       where tenant_id = $1 and active = true
       order by name asc`,
      [tenantId],
    );
    return result.rows.map(mapDocumentTypeRow);
  }

  // Application document management

  async createApplicationDocument(
    tenantId: string,
    applicationId: string,
    documentTypeId: string,
  ): Promise<ApplicationDocument> {
    const result = await this.database.query(
      `insert into academy_application_documents (
         tenant_id, application_id, document_type_id
       ) values ($1, $2, $3)
       returning *`,
      [tenantId, applicationId, documentTypeId],
    );
    return mapApplicationDocumentRow(result.rows[0]);
  }

  async findApplicationDocument(
    tenantId: string,
    documentId: string,
  ): Promise<ApplicationDocument | undefined> {
    const result = await this.database.query(
      `select * from academy_application_documents
       where tenant_id = $1 and id = $2`,
      [tenantId, documentId],
    );
    return result.rows[0] ? mapApplicationDocumentRow(result.rows[0]) : undefined;
  }

  async getDocumentChecklist(
    tenantId: string,
    applicationId: string,
  ): Promise<DocumentChecklistItem[]> {
    const result = await this.database.query(
      `select
         dt.id as document_type_id,
         dt.name as document_type_name,
         dt.slug as document_type_slug,
         dt.required,
         dt.description,
         doc.id as document_id,
         doc.tenant_id,
         doc.application_id,
         doc.status,
         doc.storage_path,
         doc.uploaded_at,
         doc.uploaded_by,
         doc.received_at,
         doc.received_by,
         doc.waived_at,
         doc.waived_by,
         doc.waiver_note,
         doc.created_at as document_created_at,
         doc.updated_at as document_updated_at
       from academy_document_types dt
       left join academy_application_documents doc
         on doc.tenant_id = dt.tenant_id
        and doc.application_id = $2
        and doc.document_type_id = dt.id
       where dt.tenant_id = $1 and dt.active = true
       order by dt.name asc`,
      [tenantId, applicationId],
    );
    return result.rows.map(mapDocumentChecklistItemRow);
  }

  async confirmDocumentUpload(
    tenantId: string,
    documentId: string,
    storagePath: string,
    uploadedBy: string,
  ): Promise<ApplicationDocument | undefined> {
    const result = await this.database.query(
      `update academy_application_documents
       set status = 'uploaded',
           storage_path = $3,
           uploaded_at = now(),
           uploaded_by = $4,
           updated_at = now()
       where tenant_id = $1 and id = $2 and status = 'pending'
       returning *`,
      [tenantId, documentId, storagePath, uploadedBy],
    );
    return result.rows[0] ? mapApplicationDocumentRow(result.rows[0]) : undefined;
  }

  async markDocumentReceived(
    tenantId: string,
    documentId: string,
    receivedBy: string,
  ): Promise<ApplicationDocument | undefined> {
    const result = await this.database.query(
      `update academy_application_documents
       set status = 'received',
           received_at = now(),
           received_by = $3,
           updated_at = now()
       where tenant_id = $1 and id = $2 and status in ('uploaded', 'pending')
       returning *`,
      [tenantId, documentId, receivedBy],
    );
    return result.rows[0] ? mapApplicationDocumentRow(result.rows[0]) : undefined;
  }

  async waiveDocument(
    tenantId: string,
    documentId: string,
    waivedBy: string,
    waiverNote: string,
  ): Promise<ApplicationDocument | undefined> {
    const result = await this.database.query(
      `update academy_application_documents
       set status = 'waived',
           waived_at = now(),
           waived_by = $3,
           waiver_note = $4,
           updated_at = now()
       where tenant_id = $1 and id = $2
       returning *`,
      [tenantId, documentId, waivedBy, waiverNote],
    );
    return result.rows[0] ? mapApplicationDocumentRow(result.rows[0]) : undefined;
  }

  async canAdvanceToDecision(
    tenantId: string,
    applicationId: string,
  ): Promise<boolean> {
    const result = await this.database.query(
      `select exists (
         select 1
         from academy_document_types dt
         where dt.tenant_id = $1
           and dt.active = true
           and dt.required = true
           and not exists (
             select 1
             from academy_application_documents doc
             where doc.tenant_id = $1
               and doc.application_id = $2
               and doc.document_type_id = dt.id
               and doc.status in ('received', 'waived')
           )
       ) as has_missing_required`,
      [tenantId, applicationId],
    );
    return !result.rows[0].has_missing_required;
  }

  async getMissingRequiredDocuments(
    tenantId: string,
    applicationId: string,
  ): Promise<Array<{ documentTypeId: string; name: string }>> {
    const result = await this.database.query(
      `select dt.id as document_type_id, dt.name
       from academy_document_types dt
       where dt.tenant_id = $1
         and dt.active = true
         and dt.required = true
         and not exists (
           select 1
           from academy_application_documents doc
           where doc.tenant_id = $1
             and doc.application_id = $2
             and doc.document_type_id = dt.id
             and doc.status in ('received', 'waived')
         )
       order by dt.name asc`,
      [tenantId, applicationId],
    );
    return result.rows.map((row) => ({
      documentTypeId: String(row.document_type_id),
      name: String(row.name),
    }));
  }
}

// Mappers

function mapDocumentTypeRow(row: Record<string, unknown>): DocumentType {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    slug: String(row.slug),
    required: Boolean(row.required),
    description: row.description === null || row.description === undefined ? undefined : String(row.description),
    active: Boolean(row.active),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapApplicationDocumentRow(row: Record<string, unknown>): ApplicationDocument {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    applicationId: String(row.application_id),
    documentTypeId: String(row.document_type_id),
    status: row.status as ApplicationDocumentStatus,
    storagePath: row.storage_path === null || row.storage_path === undefined ? undefined : String(row.storage_path),
    uploadedAt: optionalIso(row.uploaded_at),
    uploadedBy: row.uploaded_by === null || row.uploaded_by === undefined ? undefined : String(row.uploaded_by),
    receivedAt: optionalIso(row.received_at),
    receivedBy: row.received_by === null || row.received_by === undefined ? undefined : String(row.received_by),
    waivedAt: optionalIso(row.waived_at),
    waivedBy: row.waived_by === null || row.waived_by === undefined ? undefined : String(row.waived_by),
    waiverNote: row.waiver_note === null || row.waiver_note === undefined ? undefined : String(row.waiver_note),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapDocumentChecklistItemRow(row: Record<string, unknown>): DocumentChecklistItem {
  const item: DocumentChecklistItem = {
    documentTypeId: String(row.document_type_id),
    documentTypeName: String(row.document_type_name),
    documentTypeSlug: String(row.document_type_slug),
    required: Boolean(row.required),
    description: row.description === null || row.description === undefined ? undefined : String(row.description),
  };

  if (row.document_id !== null && row.document_id !== undefined) {
    item.document = {
      id: String(row.document_id),
      tenantId: String(row.tenant_id),
      applicationId: String(row.application_id),
      documentTypeId: String(row.document_type_id),
      status: row.status as ApplicationDocumentStatus,
      storagePath: row.storage_path === null || row.storage_path === undefined ? undefined : String(row.storage_path),
      uploadedAt: optionalIso(row.uploaded_at),
      uploadedBy: row.uploaded_by === null || row.uploaded_by === undefined ? undefined : String(row.uploaded_by),
      receivedAt: optionalIso(row.received_at),
      receivedBy: row.received_by === null || row.received_by === undefined ? undefined : String(row.received_by),
      waivedAt: optionalIso(row.waived_at),
      waivedBy: row.waived_by === null || row.waived_by === undefined ? undefined : String(row.waived_by),
      waiverNote: row.waiver_note === null || row.waiver_note === undefined ? undefined : String(row.waiver_note),
      createdAt: iso(row.document_created_at),
      updatedAt: iso(row.document_updated_at),
    };
  }

  return item;
}
