import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import {
  AcademyActor,
  AcademyRole,
} from "@/modules/academy-auth/policy";

const enrollmentConversionRoles = new Set<AcademyRole>([
  "institution_admin",
  "registrar",
  "admissions",
]);

export function canAccessEnrollmentConversion(
  actor: AcademyActor,
  tenantId: string,
) {
  return (
    actor.tenantId === tenantId &&
    actor.roles.some((role) => enrollmentConversionRoles.has(role))
  );
}

export function assertEnrollmentConversionAccess(
  actor: AcademyActor,
  tenantId: string,
) {
  if (!canAccessEnrollmentConversion(actor, tenantId)) {
    throw new AcademyAuthorizationError(
      "Forbidden enrollment conversion access.",
    );
  }
}
