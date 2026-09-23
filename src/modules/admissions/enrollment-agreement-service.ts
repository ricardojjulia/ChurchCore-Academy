import { sha256Hex } from "@/modules/demo-feedback/fingerprint";
import { ENROLLMENT_AGREEMENT_TEXT_V1 } from "@/modules/admissions/enrollment-agreement-constants";
import {
  EnrollmentAgreementSignature,
  EnrollmentAgreementNotFoundError,
  EnrollmentAgreementInvalidStatusError,
  CreateEnrollmentAgreementInput,
  SignEnrollmentAgreementInput,
} from "@/modules/admissions/enrollment-agreement-types";
import { AcademyAuditEventInput } from "@/modules/audit/types";

interface EnrollmentAgreementRepository {
  findByApplication(
    tenantId: string,
    applicationId: string,
  ): Promise<EnrollmentAgreementSignature | undefined>;
  create(
    input: CreateEnrollmentAgreementInput,
  ): Promise<EnrollmentAgreementSignature>;
  sign(
    input: SignEnrollmentAgreementInput,
  ): Promise<EnrollmentAgreementSignature | undefined>;
}

interface AuditRepository {
  append(input: AcademyAuditEventInput): Promise<unknown>;
}

export class EnrollmentAgreementService {
  constructor(
    private readonly repository: EnrollmentAgreementRepository,
    private readonly audit: AuditRepository,
  ) {}

  async createPendingAgreement(
    tenantId: string,
    applicationId: string,
  ): Promise<EnrollmentAgreementSignature> {
    return this.repository.create({ tenantId, applicationId });
  }

  async getAgreementByApplication(
    tenantId: string,
    applicationId: string,
  ): Promise<EnrollmentAgreementSignature | undefined> {
    return this.repository.findByApplication(tenantId, applicationId);
  }

  async signAgreement(
    tenantId: string,
    applicationId: string,
    applicantPersonId: string,
    redactedIpAddress: string | null,
    correlationId: string,
  ): Promise<EnrollmentAgreementSignature> {
    const agreementTextHash = sha256Hex(ENROLLMENT_AGREEMENT_TEXT_V1);

    const signed = await this.repository.sign({
      tenantId,
      applicationId,
      applicantPersonId,
      agreementTextHash,
      redactedIpAddress,
    });

    if (!signed) {
      // No rows updated — check current state
      const existing = await this.repository.findByApplication(
        tenantId,
        applicationId,
      );

      if (!existing) {
        throw new EnrollmentAgreementNotFoundError(
          "Enrollment agreement not found for this application.",
        );
      }

      // Already signed — idempotent success
      if (existing.status === "signed") {
        return existing;
      }

      // Unexpected state
      throw new EnrollmentAgreementInvalidStatusError(
        "Enrollment agreement is in an unexpected state.",
      );
    }

    // Write audit event (metadata must NOT include hash or IP per validateAuditMetadata rules)
    await this.audit.append({
      tenantId,
      actorPersonId: applicantPersonId,
      action: "admission.agreement.signed",
      entityType: "enrollment_agreement_signature",
      entityId: signed.id,
      resultStatus: "signed",
      correlationId,
      redactedMetadata: {
        applicationId,
      },
    });

    return signed;
  }
}
