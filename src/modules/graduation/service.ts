import { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import {
  AcademyAuthorizationError,
  AcademyConflictError,
} from "@/modules/academy-auth/errors";
import {
  GraduationClearance,
  GraduationClearanceRepository,
  InitiateClearanceInput,
  UpdateClearanceInput,
} from "@/modules/graduation/types";

export const GRADUATION_REVIEW_ROLES = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
]);

function assertGraduationReviewAccess(actor: AcademyActor, tenantId: string): void {
  if (actor.tenantId !== tenantId) {
    throw new AcademyAuthorizationError(
      "Cross-tenant graduation clearance access is not permitted.",
    );
  }
  const hasRole = actor.roles.some((r) => GRADUATION_REVIEW_ROLES.has(r));
  if (!hasRole) {
    throw new AcademyAuthorizationError(
      "Graduation clearance requires institution_admin, dean, registrar, or academic_admin role.",
    );
  }
}

export function canReviewGraduation(actor: AcademyActor): boolean {
  return actor.roles.some((role) => GRADUATION_REVIEW_ROLES.has(role));
}

export class GraduationClearanceService {
  constructor(private readonly repo: GraduationClearanceRepository) {}

  async initiate(
    actor: AcademyActor,
    input: InitiateClearanceInput,
  ): Promise<GraduationClearance> {
    assertGraduationReviewAccess(actor, actor.tenantId);
    await this.assertStudentInTenant(actor, input.studentProfileId);

    // Idempotency guard: reject if a non-deferred clearance already exists for
    // the same student + program + year combination.
    const existing = await this.repo.findByStudent(
      actor.tenantId,
      input.studentProfileId,
    );
    if (existing && existing.status !== "deferred") {
      throw new AcademyConflictError(
        `A graduation clearance for this student already exists with status '${existing.status}'. ` +
          "Defer the existing record before initiating a new one.",
      );
    }

    return this.repo.create(actor.tenantId, actor.userId, input);
  }

  async update(
    actor: AcademyActor,
    input: UpdateClearanceInput,
  ): Promise<GraduationClearance> {
    assertGraduationReviewAccess(actor, actor.tenantId);

    if (input.action === "defer" && !input.deferredReason?.trim()) {
      throw new Error(
        "A deferredReason is required when deferring a graduation clearance.",
      );
    }

    // Verify the clearance exists and belongs to this tenant.
    const clearance = await this.repo.findById(
      actor.tenantId,
      input.clearanceId,
    );
    if (!clearance || clearance.tenantId !== actor.tenantId) {
      throw new AcademyAuthorizationError(
        "Graduation clearance not found or does not belong to this tenant.",
      );
    }

    // A decision is final: only a pending clearance can be cleared or deferred. (Without this,
    // a cleared record could be silently deferred or re-cleared, rewriting the audit trail.)
    if (clearance.status !== "pending") {
      throw new AcademyConflictError(
        `This graduation clearance was already ${clearance.status}. Initiate a new clearance instead.`,
      );
    }

    return this.repo.update(actor.tenantId, actor.userId, input);
  }

  /** Latest clearance status for each of the given students (graduation audit page). */
  async statusesForStudents(
    actor: AcademyActor,
    studentProfileIds: string[],
  ): Promise<Map<string, GraduationClearance["status"]>> {
    assertGraduationReviewAccess(actor, actor.tenantId);
    if (studentProfileIds.length === 0) return new Map();
    return this.repo.latestStatusesForStudents(actor.tenantId, studentProfileIds);
  }

  async getForStudent(
    actor: AcademyActor,
    studentProfileId: string,
  ): Promise<GraduationClearance | undefined> {
    assertGraduationReviewAccess(actor, actor.tenantId);
    await this.assertStudentInTenant(actor, studentProfileId);
    const clearance = await this.repo.findByStudent(actor.tenantId, studentProfileId);
    if (clearance && clearance.tenantId !== actor.tenantId) {
      throw new AcademyAuthorizationError("Cross-tenant graduation clearance access is not permitted.");
    }
    return clearance;
  }

  // Tenant isolation is enforced here, before any clearance data is read or written, not left
  // to the repository's WHERE clause or the database foreign keys alone.
  private async assertStudentInTenant(actor: AcademyActor, studentProfileId: string) {
    if (!(await this.repo.studentBelongsToTenant(actor.tenantId, studentProfileId))) {
      throw new AcademyAuthorizationError("Student not found in this institution.");
    }
  }
}
