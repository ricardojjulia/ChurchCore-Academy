import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";

const gradebookStaffRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "faculty",
  "teacher",
  "professor",
]);

const gradebookAdminRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
]);

export function canWriteGradebook(actor: AcademyActor) {
  return actor.roles.some((role) => gradebookStaffRoles.has(role));
}

export function canOverrideGradebook(actor: AcademyActor) {
  return actor.roles.some((role) => gradebookAdminRoles.has(role) || gradebookStaffRoles.has(role));
}

export function canAdministerGradebook(actor: AcademyActor) {
  return actor.roles.some((role) => gradebookAdminRoles.has(role));
}

export function assertGradebookWriteAccess(actor: AcademyActor) {
  if (!canWriteGradebook(actor)) {
    throw new Error("Forbidden gradebook write access.");
  }
}

export function assertGradebookOverrideAccess(actor: AcademyActor) {
  if (!canOverrideGradebook(actor)) {
    throw new Error("Forbidden gradebook override access.");
  }
}

export function assertGradebookAdminAccess(actor: AcademyActor) {
  if (!canAdministerGradebook(actor)) {
    throw new Error("Forbidden gradebook administration access.");
  }
}
