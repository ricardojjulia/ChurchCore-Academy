import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type {
  BillingLedgerEntry,
  BillingPaymentIntent,
  BillingPaymentProvider,
  BillingRepository,
  StudentAccountStatement,
} from "@/modules/billing/types";

const billingAdminRoles = new Set<AcademyRole>([
  "institution_admin",
  "registrar",
  "academic_admin",
  "dean",
]);

export function hasBillingAdminAccess(actor: AcademyActor) {
  return actor.roles.some((role) => billingAdminRoles.has(role));
}

function assertBillingAdmin(actor: AcademyActor) {
  if (!hasBillingAdminAccess(actor)) {
    throw new AcademyAuthorizationError(
      "Forbidden student account administration access.",
    );
  }
}

function assertPositiveAmount(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("amountCents must be a positive integer.");
  }
}

function normalizeCurrency(currency: string) {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("currency must be a three-letter ISO currency code.");
  }
  return normalized;
}

function requireText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
}

export function buildProviderSafePaymentIntent(input: {
  provider: BillingPaymentProvider;
  providerReference?: string;
  clientSecret?: string;
  amountCents: number;
  currency: string;
}) {
  return {
    provider: input.provider,
    providerReference: input.providerReference,
    amountCents: input.amountCents,
    currency: normalizeCurrency(input.currency),
    clientSecretRedacted: true as const,
  };
}

export class BillingService {
  constructor(private readonly repository: BillingRepository) {}

  async assessCharge(
    actor: AcademyActor,
    input: {
      studentPersonId: string;
      amountCents: number;
      currency: string;
      description: string;
      sourceId?: string;
      idempotencyKey: string;
    },
  ): Promise<BillingLedgerEntry> {
    assertBillingAdmin(actor);
    assertPositiveAmount(input.amountCents);

    return this.repository.postLedgerEntry({
      tenantId: actor.tenantId,
      studentPersonId: requireText(input.studentPersonId, "studentPersonId"),
      entryType: "charge",
      amountCents: input.amountCents,
      currency: normalizeCurrency(input.currency),
      description: requireText(input.description, "description"),
      sourceType: "manual",
      sourceId: input.sourceId,
      postedByPersonId: actor.userId,
      idempotencyKey: requireText(input.idempotencyKey, "idempotencyKey"),
    });
  }

  async applyCredit(
    actor: AcademyActor,
    input: {
      studentPersonId: string;
      amountCents: number;
      currency: string;
      description: string;
      sourceId?: string;
      idempotencyKey: string;
    },
  ): Promise<BillingLedgerEntry> {
    assertBillingAdmin(actor);
    assertPositiveAmount(input.amountCents);

    return this.repository.postLedgerEntry({
      tenantId: actor.tenantId,
      studentPersonId: requireText(input.studentPersonId, "studentPersonId"),
      entryType: "credit",
      amountCents: -input.amountCents,
      currency: normalizeCurrency(input.currency),
      description: requireText(input.description, "description"),
      sourceType: "manual",
      sourceId: input.sourceId,
      postedByPersonId: actor.userId,
      idempotencyKey: requireText(input.idempotencyKey, "idempotencyKey"),
    });
  }

  async createPaymentIntent(
    actor: AcademyActor,
    input: {
      studentPersonId: string;
      amountCents: number;
      currency: string;
      provider: BillingPaymentProvider;
      idempotencyKey: string;
    },
  ): Promise<BillingPaymentIntent> {
    if (!hasBillingAdminAccess(actor) && input.studentPersonId !== actor.userId) {
      throw new AcademyAuthorizationError(
        "Students can create payment intents only for their own account.",
      );
    }
    assertPositiveAmount(input.amountCents);

    return this.repository.createPaymentIntent({
      tenantId: actor.tenantId,
      studentPersonId: requireText(input.studentPersonId, "studentPersonId"),
      amountCents: input.amountCents,
      currency: normalizeCurrency(input.currency),
      provider: input.provider,
      createdByPersonId: actor.userId,
      idempotencyKey: requireText(input.idempotencyKey, "idempotencyKey"),
    });
  }

  async postPayment(
    actor: AcademyActor,
    input: {
      studentPersonId: string;
      amountCents: number;
      currency: string;
      provider: BillingPaymentProvider;
      providerReference: string;
      description: string;
      idempotencyKey: string;
    },
  ): Promise<BillingLedgerEntry> {
    assertBillingAdmin(actor);
    assertPositiveAmount(input.amountCents);

    return this.repository.markPaymentPosted({
      tenantId: actor.tenantId,
      studentPersonId: requireText(input.studentPersonId, "studentPersonId"),
      amountCents: input.amountCents,
      currency: normalizeCurrency(input.currency),
      provider: input.provider,
      providerReference: requireText(input.providerReference, "providerReference"),
      description: requireText(input.description, "description"),
      postedByPersonId: actor.userId,
      idempotencyKey: requireText(input.idempotencyKey, "idempotencyKey"),
    });
  }

  async readStudentStatement(
    actor: AcademyActor,
    studentPersonId: string,
  ): Promise<StudentAccountStatement> {
    const subject = requireText(studentPersonId, "studentPersonId");
    if (!hasBillingAdminAccess(actor) && subject !== actor.userId) {
      throw new AcademyAuthorizationError(
        "Students can read only their own student account.",
      );
    }

    return this.repository.readStatement(actor.tenantId, subject);
  }
}
