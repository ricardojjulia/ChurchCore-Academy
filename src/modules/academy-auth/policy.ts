export type AcademyRole =
  | "institution_admin"
  | "dean"
  | "registrar"
  | "academic_admin"
  | "admissions"
  | "advisor"
  | "faculty"
  | "teacher"
  | "professor"
  | "student"
  | "guardian";

export type PlatformRole = "platform_staff" | "platform_admin";

export type InstitutionConfigAction = "read" | "write" | "admin";

export interface AcademyActor {
  userId: string;
  tenantId: string;
  roles: AcademyRole[];
}

const institutionConfigRoles: Record<InstitutionConfigAction, ReadonlySet<AcademyRole>> = {
  read: new Set(["institution_admin", "dean", "registrar", "academic_admin"]),
  write: new Set(["institution_admin"]),
  admin: new Set(["institution_admin"]),
};

export function canAccessInstitutionConfig(actor: AcademyActor, tenantId: string, action: InstitutionConfigAction) {
  if (actor.tenantId !== tenantId) {
    return false;
  }

  const allowedRoles = institutionConfigRoles[action];
  return actor.roles.some((role) => allowedRoles.has(role));
}

export function assertInstitutionConfigAccess(actor: AcademyActor, tenantId: string, action: InstitutionConfigAction) {
  if (!canAccessInstitutionConfig(actor, tenantId, action)) {
    throw new Error("Forbidden institution configuration access.");
  }
}

const allowedPlatformRoles = new Set<PlatformRole>(["platform_staff", "platform_admin"]);

export function canAccessPlatformStaffWorkspace(roles: string[]) {
  return roles.some((role) => allowedPlatformRoles.has(role as PlatformRole));
}

export function assertPlatformStaffWorkspaceAccess(roles: string[]) {
  if (!canAccessPlatformStaffWorkspace(roles)) {
    throw new Error("Forbidden platform staff access.");
  }
}
