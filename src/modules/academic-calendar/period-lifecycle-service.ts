import { type AcademyDatabase } from "@/lib/academy-database-context";
import { requireActor, type Actor } from "@/lib/require-actor";
import { AuditService } from "@/modules/audit/service";
import { InvalidStateTransitionError, PermanentRecordError } from "../academy-errors";
import type { AcademicPeriod } from "./types";

type PeriodRepo = {
  fetchPeriodById(tenantId: string, periodId: string): Promise<AcademicPeriod | null>;
  updatePeriodStatus(tenantId: string, periodId: string, status: AcademicPeriod["status"]): Promise<AcademicPeriod>;
  createPeriod(tenantId: string, data: Omit<AcademicPeriod, "id" | "tenantId" | "createdAt" | "updatedAt" | "status">): Promise<AcademicPeriod>;
  updatePeriod(tenantId: string, periodId: string, data: Partial<Omit<AcademicPeriod, "id" | "tenantId" | "createdAt" | "updatedAt" | "status">>): Promise<AcademicPeriod>;
};

export class AcademicPeriodLifecycleService {
  #db: AcademyDatabase;
  #repo: PeriodRepo;
  #audit: AuditService;

  constructor(db: AcademyDatabase, repo: PeriodRepo, auditService: AuditService) {
    this.#db = db;
    this.#repo = repo;
    this.#audit = auditService;
  }

  async createPeriod(actor: Actor, data: Omit<AcademicPeriod, "id" | "tenantId" | "createdAt" | "updatedAt" | "status">) {
    requireActor(actor, ["institution_admin", "registrar"]);
    const period = await this.#repo.createPeriod(actor.tenantId, data);
    await this.#audit.log(actor, "academic_period.created", { periodId: period.id, data });
    return period;
  }

  async updatePeriod(actor: Actor, periodId: string, data: Partial<Omit<AcademicPeriod, "id" | "tenantId" | "createdAt" | "updatedAt" | "status">>) {
    requireActor(actor, ["institution_admin", "registrar"]);
    const existing = await this.#repo.fetchPeriodById(actor.tenantId, periodId);
    if (!existing) throw new Error("Period not found");
    if (existing.status !== "planned") {
      throw new PermanentRecordError("Cannot update a period that is not in 'planned' status.");
    }
    const period = await this.#repo.updatePeriod(actor.tenantId, periodId, data);
    await this.#audit.log(actor, "academic_period.updated", { periodId, data });
    return period;
  }

  async #transition(actor: Actor, periodId: string, from: AcademicPeriod["status"], to: AcademicPeriod["status"]) {
    const period = await this.#repo.fetchPeriodById(actor.tenantId, periodId);
    if (!period) throw new Error("Period not found");
    if (period.status !== from) {
      throw new InvalidStateTransitionError(`Cannot transition from '${period.status}'. Expected '${from}'.`);
    }
    const updatedPeriod = await this.#repo.updatePeriodStatus(actor.tenantId, periodId, to);
    await this.#audit.log(actor, "academic_period.status_changed", { periodId, from, to });
    return updatedPeriod;
  }

  async openEnrollment(actor: Actor, periodId: string) {
    requireActor(actor, ["institution_admin", "registrar"]);
    return this.#transition(actor, periodId, "planned", "enrollment_open");
  }

  async activatePeriod(actor: Actor, periodId: string) {
    requireActor(actor, ["institution_admin", "registrar"]);
    return this.#transition(actor, periodId, "enrollment_open", "active");
  }

  async completePeriod(actor: Actor, periodId: string) {
    requireActor(actor, ["institution_admin", "registrar"]);
    // In a real implementation, this would also validate that all grades are submitted.
    return this.#transition(actor, periodId, "active", "completed");
  }

  /**
   * @description Reopens a completed period. THIS IS A PRIVILEGED, AUDITED "BREAK-GLASS" OPERATION.
   * It should not be exposed to a general API and is intended for platform admins via a runbook.
   * @param actor The platform admin performing the action.
   * @param tenantId The tenant the period belongs to.
   * @param periodId The ID of the period to reopen.
   * @param reason A mandatory, detailed justification for this action.
   */
  async reopenPeriod(actor: Actor, tenantId: string, periodId: string, reason: string) {
    requireActor(actor, ["platform_admin"]);
    if (!reason?.trim()) {
      throw new Error("A reason is required to reopen a completed academic period.");
    }

    // Bypassing the standard transition logic to perform a privileged reversal.
    const period = await this.#repo.fetchPeriodById(tenantId, periodId);
    if (!period) throw new Error("Period not found");
    if (period.status !== "completed") {
      throw new InvalidStateTransitionError(`Cannot reopen a period that is not 'completed'. Current status: '${period.status}'.`);
    }

    const updatedPeriod = await this.#repo.updatePeriodStatus(tenantId, periodId, "active");

    await this.#audit.log(actor, "academic_period.reopened", {
      tenantId,
      periodId,
      reason,
    }, "HIGH");

    return updatedPeriod;
  }
}