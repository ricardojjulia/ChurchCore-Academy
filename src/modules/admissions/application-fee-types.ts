export type ApplicationFeeStatus = "pending" | "paid" | "waived";

export type ApplicationFeeType = "application_fee";

export interface ApplicationFeeCharge {
  id: string;
  tenantId: string;
  applicationId: string;
  feeType: ApplicationFeeType;
  amountCents: number;
  currency: string;
  status: ApplicationFeeStatus;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: string;
  paidByPersonId?: string;
  waivedByPersonId?: string;
  waivedReason?: string;
  waivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationFeeChargeInput {
  tenantId: string;
  applicationId: string;
  feeType: ApplicationFeeType;
  amountCents: number;
  currency: string;
}

export interface TransitionToPaidInput {
  paidByPersonId?: string;
  stripePaymentIntentId?: string;
}

export interface TransitionToWaivedInput {
  waivedByPersonId: string;
  waivedReason: string;
}
