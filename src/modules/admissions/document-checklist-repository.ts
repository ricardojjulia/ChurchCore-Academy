import { getDatabasePool } from "@/lib/database";
import {
  ApplicationDocumentItem,
  CreateProgramRequirementInput,
  DocumentItemStatus,
  ProgramDocumentRequirement,
} from "@/modules/admissions/document-checklist";
import { AdmissionApplication, AdmissionApplicationStatus } from "@/modules/admissions/types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface DocumentChecklistDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function optionalIso(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : iso(value);
}

function mapProgramDocumentRequirementRow(
  row: Record<string, unknown>,
): ProgramDocumentRequirement {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    programId: String(row.program_id),
    label: String(row.label),
    description:
      row.description === null || row.description === undefined
        ? undefined
        : String(row.description),
    isRequired: Boolean(row.is_required),
    displayOrder: Number(row.display_order),
  };
}

function mapApplicationDocumentItemRow(
  row: Record<string, unknown>,
): ApplicationDocumentItem {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    applicationId: String(row.application_id),
    requirementId: String(row.requirement_id),
    label: String(row.label),
    isRequired: Boolean(row.is_required),
    status: row.status as DocumentItemStatus,
    storagePath:
      row.storage_path === null || row.storage_path === undefined
        ? undefined
        : String(row.storage_path),
    storageFilename:
      row.storage_filename === null || row.storage_filename === undefined
        ? undefined
        : String(row.storage_filename),
    officerNote:
      row.officer_note === null || row.officer_note === undefined
        ? undefined
        : String(row.officer_note),
    reviewedByPersonId:
      row.reviewed_by_person_id === null ||
      row.reviewed_by_person_id === undefined
        ? undefined
        : String(row.reviewed_by_person_id),
    reviewedAt: optionalIso(row.reviewed_at),
    uploadedAt: optionalIso(row.uploaded_at),
  };
}

function mapAdmissionApplicationRow(
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

export class PostgresDocumentChecklistRepository {
  constructor(
    private readonly database: DocumentChecklistDatabase = getDatabasePool(),
  ) {}

  async programBelongsToTenant(tenantId: string, programId: string) {
    const result = await this.database.query(
      `select 1 from academy_academic_programs where tenant_id = $1 and id = $2 limit 1`,
      [tenantId, programId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findProgramRequirementById(tenantId: string, requirementId: string) {
    const result = await this.database.query(
      `select *
       from academy_program_document_requirements
       where tenant_id = $1 and id = $2`,
      [tenantId, requirementId],
    );
    return result.rows[0]
      ? mapProgramDocumentRequirementRow(result.rows[0])
      : undefined;
  }

  async listProgramRequirements(tenantId: string, programId: string) {
    const result = await this.database.query(
      `select *
       from academy_program_document_requirements
       where tenant_id = $1 and program_id = $2
       order by display_order, label`,
      [tenantId, programId],
    );
    return result.rows.map(mapProgramDocumentRequirementRow);
  }

  async createProgramRequirement(
    tenantId: string,
    input: CreateProgramRequirementInput,
  ) {
    const result = await this.database.query(
      `insert into academy_program_document_requirements (
         tenant_id, program_id, label, description, is_required, display_order
       ) values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [
        tenantId,
        input.programId,
        input.label,
        input.description ?? null,
        input.isRequired,
        input.displayOrder ?? 0,
      ],
    );
    return mapProgramDocumentRequirementRow(result.rows[0]);
  }

  async deleteProgramRequirement(tenantId: string, requirementId: string) {
    await this.database.query(
      `delete from academy_program_document_requirements
       where tenant_id = $1 and id = $2`,
      [tenantId, requirementId],
    );
  }

  async countApplicationsUsingRequirement(
    tenantId: string,
    requirementId: string,
  ) {
    const result = await this.database.query(
      `select count(*) as count
       from academy_application_document_items
       where tenant_id = $1 and requirement_id = $2`,
      [tenantId, requirementId],
    );
    return Number(result.rows[0].count);
  }

  async findApplicationDocumentItemById(
    tenantId: string,
    documentItemId: string,
  ) {
    const result = await this.database.query(
      `select *
       from academy_application_document_items
       where tenant_id = $1 and id = $2`,
      [tenantId, documentItemId],
    );
    return result.rows[0]
      ? mapApplicationDocumentItemRow(result.rows[0])
      : undefined;
  }

  async listApplicationDocumentItems(tenantId: string, applicationId: string) {
    const result = await this.database.query(
      `select *
       from academy_application_document_items
       where tenant_id = $1 and application_id = $2
       order by created_at`,
      [tenantId, applicationId],
    );
    return result.rows.map(mapApplicationDocumentItemRow);
  }

  async createApplicationDocumentItems(
    tenantId: string,
    applicationId: string,
    requirements: ProgramDocumentRequirement[],
  ) {
    if (requirements.length === 0) {
      return [];
    }
    const values = requirements
      .map((req, index) => {
        const base = index * 5 + 1;
        return `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      })
      .join(", ");
    const params = requirements.flatMap((req) => [
      tenantId,
      applicationId,
      req.id,
      req.label,
      req.isRequired,
    ]);
    const result = await this.database.query(
      `insert into academy_application_document_items (
         tenant_id, application_id, requirement_id, label, is_required
       ) values ${values}
       returning *`,
      params,
    );
    return result.rows.map(mapApplicationDocumentItemRow);
  }

  async updateDocumentItemUpload(
    tenantId: string,
    documentItemId: string,
    storagePath: string,
    storageFilename: string,
    uploadedAt: string,
  ) {
    const result = await this.database.query(
      `update academy_application_document_items
       set status = 'uploaded',
           storage_path = $3,
           storage_filename = $4,
           uploaded_at = $5,
           updated_at = now()
       where tenant_id = $1 and id = $2
       returning *`,
      [tenantId, documentItemId, storagePath, storageFilename, uploadedAt],
    );
    if (!result.rows[0]) {
      throw new Error("Document item not found during upload update.");
    }
    return mapApplicationDocumentItemRow(result.rows[0]);
  }

  async updateDocumentItemReview(
    tenantId: string,
    documentItemId: string,
    status: DocumentItemStatus,
    reviewedByPersonId: string,
    reviewedAt: string,
    officerNote?: string,
  ) {
    const result = await this.database.query(
      `update academy_application_document_items
       set status = $3,
           reviewed_by_person_id = $4,
           reviewed_at = $5,
           officer_note = $6,
           updated_at = now()
       where tenant_id = $1 and id = $2
       returning *`,
      [
        tenantId,
        documentItemId,
        status,
        reviewedByPersonId,
        reviewedAt,
        officerNote ?? null,
      ],
    );
    if (!result.rows[0]) {
      throw new Error("Document item not found during review update.");
    }
    return mapApplicationDocumentItemRow(result.rows[0]);
  }

  async findApplicationByDocumentItemId(
    tenantId: string,
    documentItemId: string,
  ) {
    const result = await this.database.query(
      `select app.*
       from academy_admission_applications app
       join academy_application_document_items item
         on item.tenant_id = app.tenant_id
        and item.application_id = app.id
       where item.tenant_id = $1 and item.id = $2`,
      [tenantId, documentItemId],
    );
    return result.rows[0]
      ? mapAdmissionApplicationRow(result.rows[0])
      : undefined;
  }
}
