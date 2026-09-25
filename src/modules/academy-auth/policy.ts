import type { InstitutionCapabilitySet } from "@/modules/academy-config/types";
import { AcademyAuthorizationError } from "./errors";

// Single source of truth for every valid AcademyRole value. Any code that needs to
// validate, parse, or enumerate roles at runtime (e.g. filtering DB rows to known roles)
// must derive from this array rather than hand-typing its own list — a hand-typed copy
// silently drops new roles when this union grows, which previously caused any user whose
// only role was "finance", "alumni_relations", or "ministry_formation_reviewer" to be
// treated as roleless and hit an authentication-error redirect loop.
export const ACADEMY_ROLES = [
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
  "finance",
  "applicant",
  "advisor",
  "faculty",
  "teacher",
  "professor",
  "student",
  "guardian",
  "alumni_relations",
  "ministry_formation_reviewer",
] as const;

export type AcademyRole = (typeof ACADEMY_ROLES)[number];

export type PlatformRole = "platform_staff" | "platform_admin";

export type InstitutionConfigAction = "read" | "write" | "admin";

export type ShepherdAiAction = "read" | "write";

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

const shepherdAiRoles: Record<ShepherdAiAction, ReadonlySet<AcademyRole>> = {
  read: new Set(["academic_admin"]),
  write: new Set(["academic_admin"]),
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
    throw new AcademyAuthorizationError("Forbidden institution configuration access.");
  }
}

export function canAccessShepherdAi(actor: AcademyActor, tenantId: string, action: ShepherdAiAction) {
  if (actor.tenantId !== tenantId) {
    return false;
  }

  const allowedRoles = shepherdAiRoles[action];
  return actor.roles.some((role) => allowedRoles.has(role));
}

export function assertShepherdAiAccess(actor: AcademyActor, tenantId: string, action: ShepherdAiAction) {
  if (!canAccessShepherdAi(actor, tenantId, action)) {
    throw new AcademyAuthorizationError("Forbidden ShepherdAI access.");
  }
}

const allowedPlatformRoles = new Set<PlatformRole>(["platform_staff", "platform_admin"]);

export function canAccessPlatformStaffWorkspace(roles: string[]) {
  return roles.some((role) => allowedPlatformRoles.has(role as PlatformRole));
}

export function assertPlatformStaffWorkspaceAccess(roles: string[]) {
  if (!canAccessPlatformStaffWorkspace(roles)) {
    throw new AcademyAuthorizationError("Forbidden platform staff access.");
  }
}

export function assertStudentPortalAccess(
  actor: AcademyActor,
  capabilities?: InstitutionCapabilitySet,
): void {
  if (!actor.roles.includes("student")) {
    throw new AcademyAuthorizationError("Forbidden student portal access.");
  }
  if (capabilities) {
    assertCapability(capabilities, "studentPwa");
  }
}

export class CapabilityDisabledError extends Error {
  readonly statusCode = 451;
  constructor(readonly capability: string) {
    super(`Capability '${capability}' is not enabled for this institution.`);
  }
}

export function assertCapability(
  capabilities: InstitutionCapabilitySet,
  key: keyof InstitutionCapabilitySet,
): void {
  if (!capabilities[key]) {
    throw new CapabilityDisabledError(key);
  }
}
