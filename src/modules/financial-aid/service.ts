import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import {
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import type {
  AidAward,
  AidAwardStatus,
  AidAwardType,
  AidDisbursement,
  AidHold,
  AidHoldType,
  AidPackage,
  AidSourceType,
  FinancialAidRepository,
  StudentAidSummary,
} from "@/modules/financial-aid/types";

const aidAdminRoles = new Set<AcademyRole>([
  "institution_admin",
  "registrar",
  "academic_admin",
  "dean",
  "finance",
]);

const regulatedAidAwardTypes = new Set<AidAwardType>([
  "federal_grant",
  "federal_loan",
]);

export function hasFinancialAidAdminAccess(actor: AcademyActor) {
  return actor.roles.some((role) => aidAdminRoles.has(role));
}

function assertAidAdmin(actor: AcademyActor) {
  if (!hasFinancialAidAdminAccess(actor)) {
    throw new AcademyAuthorizationError(
      "Forbidden financial aid administration access.",
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

function assertInstitutionalAidOnly(input: {
  awardType: AidAwardType;
  sourceType: AidSourceType;
}) {
  if (regulatedAidAwardTypes.has(input.awardType) || input.sourceType === "federal") {
    throw new AcademyConflictError(
      "Federal and regulated aid are disabled until the compliance activation gate is approved.",
    );
  }
}

export class FinancialAidService {
  constructor(private readonly repository: FinancialAidRepository) {}

  async createPackage(
    actor: AcademyActor,
    input: {
      studentPersonId: string;
      aidYear: string;
    },
  ): Promise<AidPackage> {
    assertAidAdmin(actor);
    return this.repository.createPackage({
      tenantId: actor.tenantId,
      studentPersonId: requireText(input.studentPersonId, "studentPersonId"),
      aidYear: requireText(input.aidYear, "aidYear"),
      createdByPersonId: actor.userId,
    });
  }

  async createAward(
    actor: AcademyActor,
    input: {
      packageId: string;
      studentPersonId: string;
      awardType: AidAwardType;
      sourceType: AidSourceType;
      amountCents: number;
      currency: string;
      description: string;
    },
  ): Promise<AidAward> {
    assertAidAdmin(actor);
    assertInstitutionalAidOnly(input);
    assertPositiveAmount(input.amountCents);

    return this.repository.createAward({
      tenantId: actor.tenantId,
      packageId: requireText(input.packageId, "packageId"),
      studentPersonId: requireText(input.studentPersonId, "studentPersonId"),
      awardType: input.awardType,
      sourceType: input.sourceType,
      amountCents: input.amountCents,
      currency: normalizeCurrency(input.currency),
      description: requireText(input.description, "description"),
      createdByPersonId: actor.userId,
    });
  }

  async updateAwardStatus(
    actor: AcademyActor,
    input: {
      awardId: string;
      status: AidAwardStatus;
    },
  ): Promise<AidAward> {
    assertAidAdmin(actor);
    return this.repository.updateAwardStatus({
      tenantId: actor.tenantId,
      awardId: requireText(input.awardId, "awardId"),
      status: input.status,
      updatedByPersonId: actor.userId,
    });
  }

  async scheduleDisbursement(
    actor: AcademyActor,
    input: {
      awardId: string;
      studentPersonId: string;
      amountCents: number;
      currency: string;
      scheduledOn: string;
      idempotencyKey: string;
    },
  ): Promise<AidDisbursement> {
    assertAidAdmin(actor);
    assertPositiveAmount(input.amountCents);

    return this.repository.scheduleDisbursement({
      tenantId: actor.tenantId,
      awardId: requireText(input.awardId, "awardId"),
      studentPersonId: requireText(input.studentPersonId, "studentPersonId"),
      amountCents: input.amountCents,
      currency: normalizeCurrency(input.currency),
      scheduledOn: requireText(input.scheduledOn, "scheduledOn"),
      idempotencyKey: requireText(input.idempotencyKey, "idempotencyKey"),
    });
  }

  async postDisbursement(
    actor: AcademyActor,
    input: {
      disbursementId: string;
      idempotencyKey: string;
    },
  ): Promise<AidDisbursement> {
    assertAidAdmin(actor);
    return this.repository.postDisbursement({
      tenantId: actor.tenantId,
      disbursementId: requireText(input.disbursementId, "disbursementId"),
      postedByPersonId: actor.userId,
      idempotencyKey: requireText(input.idempotencyKey, "idempotencyKey"),
    });
  }

  async createHold(
    actor: AcademyActor,
    input: {
      studentPersonId: string;
      holdType: AidHoldType;
      reason: string;
    },
  ): Promise<AidHold> {
    assertAidAdmin(actor);
    return this.repository.createHold({
      tenantId: actor.tenantId,
      studentPersonId: requireText(input.studentPersonId, "studentPersonId"),
      holdType: input.holdType,
      reason: requireText(input.reason, "reason"),
      createdByPersonId: actor.userId,
    });
  }

  async readStudentAid(
    actor: AcademyActor,
    studentPersonId: string,
  ): Promise<StudentAidSummary> {
    const subject = requireText(studentPersonId, "studentPersonId");
    if (!hasFinancialAidAdminAccess(actor) && subject !== actor.userId) {
      throw new AcademyAuthorizationError(
        "Students can read only their own financial aid summary.",
      );
    }
    return this.repository.readStudentAid(actor.tenantId, subject);
  }
}
