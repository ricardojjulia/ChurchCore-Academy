import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError, AcademyConflictError } from "@/modules/academy-auth/errors";
import {
  ApplicationFeeCharge,
  ApplicationFeeType,
  TransitionToPaidInput,
  TransitionToWaivedInput,
} from "@/modules/admissions/application-fee-types";

interface ApplicationFeeRepository {
  findByApplication(
    tenantId: string,
    applicationId: string,
    feeType: ApplicationFeeType,
  ): Promise<ApplicationFeeCharge | undefined>;
  transitionToPaid(
    tenantId: string,
    applicationId: string,
    feeType: ApplicationFeeType,
    input: TransitionToPaidInput,
  ): Promise<ApplicationFeeCharge | undefined>;
  transitionToWaived(
    tenantId: string,
    applicationId: string,
    feeType: ApplicationFeeType,
    input: TransitionToWaivedInput,
  ): Promise<ApplicationFeeCharge | undefined>;
}

const staffRoles = new Set([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
]);

// Tenant isolation for these operations comes entirely from the repository layer —
// every query is scoped by `tenant_id = actor.tenantId`, so a cross-tenant applicationId
// simply matches no rows. There is no separate tenantId to compare against here (the
// actor's own tenantId is the only one ever in scope), so this only checks role.
function assertStaffAccess(actor: AcademyActor) {
  if (!actor.roles.some((role) => staffRoles.has(role))) {
    throw new AcademyAuthorizationError(
      "Forbidden application fee access.",
    );
  }
}

export class ApplicationFeeService {
  constructor(
    private readonly repository: ApplicationFeeRepository,
  ) {}

  async findFeeCharge(
    actor: AcademyActor,
    applicationId: string,
    feeType: ApplicationFeeType = "application_fee",
  ): Promise<ApplicationFeeCharge | undefined> {
    assertStaffAccess(actor);
    return this.repository.findByApplication(
      actor.tenantId,
      applicationId,
      feeType,
    );
  }

  async recordManualPayment(
    actor: AcademyActor,
    applicationId: string,
    feeType: ApplicationFeeType = "application_fee",
  ): Promise<ApplicationFeeCharge> {
    assertStaffAccess(actor);

    const updated = await this.repository.transitionToPaid(
      actor.tenantId,
      applicationId,
      feeType,
      { paidByPersonId: actor.userId },
    );

    if (!updated) {
      // Idempotent — already paid or waived, fetch current state
      const current = await this.repository.findByApplication(
        actor.tenantId,
        applicationId,
        feeType,
      );
      if (!current) {
        throw new Error("Fee charge not found.");
      }
      if (current.status === "waived") {
        throw new AcademyConflictError("Cannot record payment for a waived fee.");
      }
      return current;
    }

    return updated;
  }

  async waiveFee(
    actor: AcademyActor,
    applicationId: string,
    reason: string,
    feeType: ApplicationFeeType = "application_fee",
  ): Promise<ApplicationFeeCharge> {
    assertStaffAccess(actor);

    if (!reason.trim()) {
      throw new Error("Waiver reason is required.");
    }

    const updated = await this.repository.transitionToWaived(
      actor.tenantId,
      applicationId,
      feeType,
      { waivedByPersonId: actor.userId, waivedReason: reason.trim() },
    );

    if (!updated) {
      // Idempotent — already waived or paid, fetch current state
      const current = await this.repository.findByApplication(
        actor.tenantId,
        applicationId,
        feeType,
      );
      if (!current) {
        throw new Error("Fee charge not found.");
      }
      if (current.status === "paid") {
        throw new AcademyConflictError("Cannot waive a paid fee.");
      }
      return current;
    }

    return updated;
  }
}
