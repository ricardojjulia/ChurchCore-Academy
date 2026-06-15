import { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";

const registrationRoles = new Set([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
]);

export function canManageCourseRegistration(actor: AcademyActor, tenantId: string) {
  if (actor.tenantId !== tenantId) {
    return false;
  }

  return actor.roles.some((role) => registrationRoles.has(role));
}

export function assertCourseRegistrationAccess(actor: AcademyActor, tenantId: string) {
  if (!canManageCourseRegistration(actor, tenantId)) {
    throw new AcademyAuthorizationError("Forbidden course registration access.");
  }
}
