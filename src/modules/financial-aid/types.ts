export type AidPackageStatus = "draft" | "offered" | "accepted" | "cancelled";
export type AidAwardType =
  | "scholarship"
  | "grant"
  | "discount"
  | "sponsorship"
  | "federal_grant"
  | "federal_loan";
export type AidSourceType =
  | "institutional"
  | "denominational"
  | "mission"
  | "church"
  | "federal";
export type AidAwardStatus = "offered" | "accepted" | "declined" | "cancelled";
export type AidDisbursementStatus = "scheduled" | "posted" | "cancelled";
export type AidHoldType =
  | "documentation"
  | "sap_review"
  | "aid_review"
  | "federal_aid_disabled";
export type AidHoldStatus = "active" | "released";

export interface AidPackage {
  id: string;
  tenantId: string;
  studentPersonId: string;
  aidYear: string;
  status: AidPackageStatus;
  acceptedAt?: string;
  declinedAt?: string;
  acceptanceDeadline?: string;
  letterStatus?: string;
  createdByPersonId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AidAward {
  id: string;
  tenantId: string;
  packageId: string;
  studentPersonId: string;
  awardType: AidAwardType;
  sourceType: AidSourceType;
  status: AidAwardStatus;
  amountCents: number;
  currency: string;
  description: string;
  createdByPersonId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AidDisbursement {
  id: string;
  tenantId: string;
  awardId: string;
  studentPersonId: string;
  status: AidDisbursementStatus;
  scheduledOn: string;
  amountCents: number;
  currency: string;
  ledgerEntryId?: string;
  postedByPersonId?: string;
  postedAt?: string;
  idempotencyKey: string;
}

export interface AidHold {
  id: string;
  tenantId: string;
  studentPersonId: string;
  holdType: AidHoldType;
  status: AidHoldStatus;
  reason: string;
  createdByPersonId: string;
  createdAt: string;
  releasedByPersonId?: string;
  releasedAt?: string;
}

export interface StudentAidSummary {
  tenantId: string;
  studentPersonId: string;
  packages: AidPackage[];
  awards: AidAward[];
  disbursements: AidDisbursement[];
  activeHolds: AidHold[];
  totalAcceptedCents: number;
  totalPostedCents: number;
  currency: string;
}

export interface CreateAidPackageInput {
  tenantId: string;
  studentPersonId: string;
  aidYear: string;
  createdByPersonId: string;
}

export interface CreateAidAwardInput {
  tenantId: string;
  packageId: string;
  studentPersonId: string;
  awardType: AidAwardType;
  sourceType: AidSourceType;
  amountCents: number;
  currency: string;
  description: string;
  createdByPersonId: string;
}

export interface UpdateAidAwardStatusInput {
  tenantId: string;
  awardId: string;
  status: AidAwardStatus;
  updatedByPersonId: string;
}

export interface ScheduleAidDisbursementInput {
  tenantId: string;
  awardId: string;
  studentPersonId: string;
  amountCents: number;
  currency: string;
  scheduledOn: string;
  idempotencyKey: string;
}

export interface PostAidDisbursementInput {
  tenantId: string;
  disbursementId: string;
  postedByPersonId: string;
  idempotencyKey: string;
}

export interface CreateAidHoldInput {
  tenantId: string;
  studentPersonId: string;
  holdType: AidHoldType;
  reason: string;
  createdByPersonId: string;
}

export interface FinancialAidRepository {
  createPackage(input: CreateAidPackageInput): Promise<AidPackage>;
  createAward(input: CreateAidAwardInput): Promise<AidAward>;
  updateAwardStatus(input: UpdateAidAwardStatusInput): Promise<AidAward>;
  scheduleDisbursement(input: ScheduleAidDisbursementInput): Promise<AidDisbursement>;
  postDisbursement(input: PostAidDisbursementInput): Promise<AidDisbursement>;
  createHold(input: CreateAidHoldInput): Promise<AidHold>;
  readStudentAid(tenantId: string, studentPersonId: string): Promise<StudentAidSummary>;
}
