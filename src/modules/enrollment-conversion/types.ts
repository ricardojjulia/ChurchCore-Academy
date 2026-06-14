import { AdmissionApplication } from "@/modules/admissions/types";

export interface EnrollmentConversionResult {
  applicationId: string;
  studentProfileId: string;
  studentNumber: string;
  programEnrollmentId: string;
  periodRegistrationId: string;
  convertedAt: string;
  idempotencyKey: string;
}

export interface EnrollmentConversionInput {
  tenantId: string;
  applicationId: string;
  actorPersonId: string;
  convertedAt: string;
  correlationId: string;
  idempotencyKey: string;
}

export interface EnrollmentConversionRepository {
  findApplication(
    tenantId: string,
    applicationId: string,
  ): Promise<AdmissionApplication | undefined>;
  findReplay(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<EnrollmentConversionResult | undefined>;
  findResultByApplication(
    tenantId: string,
    applicationId: string,
  ): Promise<EnrollmentConversionResult | undefined>;
  convert(input: EnrollmentConversionInput): Promise<EnrollmentConversionResult>;
}
