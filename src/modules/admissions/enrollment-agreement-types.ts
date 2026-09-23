export type EnrollmentAgreementStatus = "pending" | "signed";

export interface EnrollmentAgreementSignature {
  id: string;
  tenantId: string;
  applicationId: string;
  status: EnrollmentAgreementStatus;
  agreementTextHash?: string;
  signedByPersonId?: string;
  signedAt?: string;
  redactedIpAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnrollmentAgreementInput {
  tenantId: string;
  applicationId: string;
}

export interface SignEnrollmentAgreementInput {
  tenantId: string;
  applicationId: string;
  applicantPersonId: string;
  agreementTextHash: string;
  redactedIpAddress: string | null;
}

export class EnrollmentAgreementNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnrollmentAgreementNotFoundError";
  }
}

export class EnrollmentAgreementInvalidStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnrollmentAgreementInvalidStatusError";
  }
}
