import {
  EnrollmentAgreementSignature,
  CreateEnrollmentAgreementInput,
  SignEnrollmentAgreementInput,
} from "@/modules/admissions/enrollment-agreement-types";

interface DatabaseClient {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function mapRow(row: Record<string, unknown>): EnrollmentAgreementSignature {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    applicationId: String(row.application_id),
    status: String(row.status) as "pending" | "signed",
    agreementTextHash: row.agreement_text_hash != null ? String(row.agreement_text_hash) : undefined,
    signedByPersonId: row.signed_by_person_id != null ? String(row.signed_by_person_id) : undefined,
    signedAt:
      row.signed_at != null
        ? row.signed_at instanceof Date
          ? row.signed_at.toISOString()
          : String(row.signed_at)
        : undefined,
    redactedIpAddress: row.redacted_ip_address != null ? String(row.redacted_ip_address) : undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

export class PostgresEnrollmentAgreementRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findByApplication(
    tenantId: string,
    applicationId: string,
  ): Promise<EnrollmentAgreementSignature | undefined> {
    const result = await this.db.query(
      `select * from academy_enrollment_agreement_signatures
       where tenant_id = $1 and application_id = $2`,
      [tenantId, applicationId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async create(
    input: CreateEnrollmentAgreementInput,
  ): Promise<EnrollmentAgreementSignature> {
    const result = await this.db.query(
      `insert into academy_enrollment_agreement_signatures (
         tenant_id, application_id, status, created_at, updated_at
       ) values ($1, $2, 'pending', now(), now())
       on conflict (application_id) do nothing
       returning *`,
      [input.tenantId, input.applicationId],
    );

    // If no row returned, the agreement already exists (conflict) — fetch it
    if (!result.rows[0]) {
      const existing = await this.findByApplication(input.tenantId, input.applicationId);
      if (!existing) {
        throw new Error("Failed to create or retrieve enrollment agreement signature.");
      }
      return existing;
    }

    return mapRow(result.rows[0]);
  }

  async sign(
    input: SignEnrollmentAgreementInput,
  ): Promise<EnrollmentAgreementSignature | undefined> {
    const result = await this.db.query(
      `update academy_enrollment_agreement_signatures
       set status = 'signed',
           signed_by_person_id = $3,
           signed_at = now(),
           agreement_text_hash = $4,
           redacted_ip_address = $5,
           updated_at = now()
       where tenant_id = $1 and application_id = $2 and status = 'pending'
       returning *`,
      [
        input.tenantId,
        input.applicationId,
        input.applicantPersonId,
        input.agreementTextHash,
        input.redactedIpAddress,
      ],
    );

    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }
}
