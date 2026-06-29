export type BillingLedgerEntryType =
  | "charge"
  | "credit"
  | "payment"
  | "refund"
  | "void";

export type BillingSourceType =
  | "manual"
  | "registration"
  | "payment"
  | "refund"
  | "aid";

export type BillingPaymentProvider = "manual" | "stripe";

export type BillingPaymentIntentStatus =
  | "requires_action"
  | "posted"
  | "voided"
  | "failed";

export interface BillingLedgerEntry {
  id: string;
  tenantId: string;
  studentPersonId: string;
  academicPeriodId: string;
  entryType: BillingLedgerEntryType;
  amountCents: number;
  currency: string;
  description: string;
  sourceType: BillingSourceType;
  sourceId?: string;
  postedByPersonId: string;
  postedAt: string;
  idempotencyKey: string;
}

export interface BillingPaymentIntent {
  id: string;
  tenantId: string;
  studentPersonId: string;
  academicPeriodId: string;
  amountCents: number;
  currency: string;
  provider: BillingPaymentProvider;
  status: BillingPaymentIntentStatus;
  providerReference?: string;
  clientSecretRedacted: true;
  createdByPersonId: string;
  createdAt: string;
  idempotencyKey: string;
}

export interface StudentAccountStatement {
  tenantId: string;
  studentPersonId: string;
  currency: string;
  balanceCents: number;
  entries: BillingLedgerEntry[];
}

export interface PostLedgerEntryInput {
  tenantId: string;
  studentPersonId: string;
  academicPeriodId: string;
  entryType: BillingLedgerEntryType;
  amountCents: number;
  currency: string;
  description: string;
  sourceType: BillingSourceType;
  sourceId?: string;
  postedByPersonId: string;
  idempotencyKey: string;
}

export interface CreatePaymentIntentInput {
  tenantId: string;
  studentPersonId: string;
  academicPeriodId: string;
  amountCents: number;
  currency: string;
  provider: BillingPaymentProvider;
  createdByPersonId: string;
  idempotencyKey: string;
}

export interface MarkPaymentPostedInput {
  tenantId: string;
  studentPersonId: string;
  academicPeriodId: string;
  amountCents: number;
  currency: string;
  provider: BillingPaymentProvider;
  providerReference: string;
  description: string;
  postedByPersonId: string;
  idempotencyKey: string;
}

export interface UpdateCheckoutSessionInput {
  tenantId: string;
  intentId: string;
  stripeCheckoutSessionId: string;
  checkoutUrl: string;
}

export interface BillingRepository {
  postLedgerEntry(input: PostLedgerEntryInput): Promise<BillingLedgerEntry>;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<BillingPaymentIntent>;
  markPaymentPosted(input: MarkPaymentPostedInput): Promise<BillingLedgerEntry>;
  readStatement(tenantId: string, studentPersonId: string): Promise<StudentAccountStatement>;
  updateCheckoutSession(input: UpdateCheckoutSessionInput): Promise<void>;
  findPaymentIntentByStripeSession(
    tenantId: string,
    stripeCheckoutSessionId: string
  ): Promise<BillingPaymentIntent | undefined>;
  studentExistsInTenant(tenantId: string, studentPersonId: string): Promise<boolean>;
  getStudentActivePeriodId(tenantId: string, studentPersonId: string): Promise<string>;
}
