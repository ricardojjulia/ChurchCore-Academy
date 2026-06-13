import {
  AcademyActor,
  AcademyRole,
} from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";

export type AdmissionsAction =
  | "create"
  | "read"
  | "submit"
  | "review"
  | "decide";

const staffRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "admissions",
]);

export function canAccessAdmissions(
  actor: AcademyActor,
  tenantId: string,
  applicantPersonId: string,
  action: AdmissionsAction,
) {
  if (actor.tenantId !== tenantId) {
    return false;
  }

  if (actor.roles.some((role) => staffRoles.has(role))) {
    return true;
  }

  return (
    actor.roles.includes("applicant") &&
    actor.userId === applicantPersonId &&
    (action === "create" || action === "read" || action === "submit")
  );
}

export function assertAdmissionsAccess(
  actor: AcademyActor,
  tenantId: string,
  applicantPersonId: string,
  action: AdmissionsAction,
) {
  if (!canAccessAdmissions(actor, tenantId, applicantPersonId, action)) {
    throw new AcademyAuthorizationError("Forbidden admissions access.");
  }
}
