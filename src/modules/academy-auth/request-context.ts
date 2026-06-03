import { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";

const allowedRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
  "advisor",
  "faculty",
  "teacher",
  "professor",
  "student",
  "guardian",
]);

function parseRoles(value: string | null): AcademyRole[] {
  const roles = value
    ?.split(",")
    .map((role) => role.trim())
    .filter((role): role is AcademyRole => allowedRoles.has(role as AcademyRole));

  return roles?.length ? roles : ["institution_admin"];
}

export function resolveBootstrapAcademyActor(headers: Headers): AcademyActor {
  return {
    userId: headers.get("x-academy-user-id") ?? "local-academy-admin",
    tenantId: headers.get("x-academy-tenant-id") ?? "cca-main",
    roles: parseRoles(headers.get("x-academy-roles")),
  };
}
