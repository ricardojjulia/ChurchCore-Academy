export type PaymentPlanType = "full" | "installment";

export type PaymentPlanStatus = "active" | "paid" | "cancelled";

export type InstallmentStatus = "pending" | "paid" | "overdue" | "waived";

export interface TuitionSchedule {
  id: string;
  tenantId: string;
  programId: string;
  termId: string;
  baseAmountCents: number;
  currency: string;
  active: boolean;
  createdByPersonId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPlan {
  id: string;
  tenantId: string;
  studentPersonId: string;
  scheduleId: string;
  registrationId: string;
  planType: PaymentPlanType;
  totalAmountCents: number;
  currency: string;
  status: PaymentPlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentPlanInstallment {
  id: string;
  tenantId: string;
  planId: string;
  installmentNumber: number;
  dueDate: string;
  amountCents: number;
  currency: string;
  status: InstallmentStatus;
  paidAt?: string;
  ledgerEntryId?: string;
  lateFeeAmountCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTuitionScheduleInput {
  programId: string;
  termId: string;
  baseAmountCents: number;
  currency?: string;
  planType: PaymentPlanType;
  installmentCount?: number;
}

export interface GeneratePaymentPlanInput {
  studentPersonId: string;
  registrationId: string;
  scheduleId: string;
}

export interface StudentPaymentPlanView {
  plan: PaymentPlan;
  installments: PaymentPlanInstallment[];
}
