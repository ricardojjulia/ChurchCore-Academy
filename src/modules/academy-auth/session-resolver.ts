import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import {
  AcademyActor,
  AcademyRole,
  PlatformRole,
} from "@/modules/academy-auth/policy";

export interface AcademyIdentityRecord {
  externalSubject: string;
  personId: string;
  tenantId: string;
  roles: AcademyRole[];
}

export interface AcademyIdentityRepository {
  findActiveIdentities(
    externalSubject: string,
    asOf: string,
  ): Promise<AcademyIdentityRecord[]>;
}

export interface PlatformTenantMembership {
  personId: string;
  tenantId: string;
  roles: AcademyRole[];
}

export interface PlatformSession {
  externalSubject: string;
  platformRoles: PlatformRole[];
  tenants: PlatformTenantMembership[];
  activeTenant: PlatformTenantMembership;
}

export interface PlatformSessionRepository extends AcademyIdentityRepository {
  findPlatformRoles(
    externalSubject: string,
    asOf: string,
  ): Promise<PlatformRole[]>;
}

export interface ResolvePlatformSessionOptions {
  asOf?: string;
  demoTenantId?: string;
  preferredTenantId?: string;
}

function uniqueRoles<T extends string>(values: T[]) {
  return [...new Set(values)];
}

function resolvePlatformMemberships(identities: AcademyIdentityRecord[]) {
  const memberships = new Map<string, PlatformTenantMembership>();

  for (const identity of identities) {
    const existing = memberships.get(identity.tenantId);

    if (!existing) {
      memberships.set(identity.tenantId, {
        personId: identity.personId,
        tenantId: identity.tenantId,
        roles: [...identity.roles],
      });
      continue;
    }

    if (existing.personId !== identity.personId) {
      throw new AcademyAuthenticationError(
        "The account has ambiguous Academy person links.",
      );
    }

    existing.roles = uniqueRoles([...existing.roles, ...identity.roles]);
  }

  return [...memberships.values()].sort((left, right) =>
    left.tenantId.localeCompare(right.tenantId),
  );
}

export async function resolvePlatformSession(
  repository: PlatformSessionRepository,
  externalSubject: string,
  options: ResolvePlatformSessionOptions = {},
): Promise<PlatformSession> {
  const asOf = options.asOf ?? new Date().toISOString();
  const identities = await repository.findActiveIdentities(externalSubject, asOf);
  const platformRoles = uniqueRoles(
    await repository.findPlatformRoles(externalSubject, asOf),
  );

  if (identities.length === 0 && platformRoles.length === 0) {
    throw new AcademyAuthenticationError();
  }

  const tenants = resolvePlatformMemberships(identities).filter(
    (membership) => membership.roles.length > 0,
  );

  if (tenants.length === 0) {
    throw new AcademyAuthenticationError(
      "The account does not have an active Academy tenant.",
    );
  }

  const activeTenant =
    tenants.find((tenant) => tenant.tenantId === options.preferredTenantId) ??
    tenants.find((tenant) => tenant.tenantId === options.demoTenantId) ??
    tenants[0];

  return {
    externalSubject,
    platformRoles,
    tenants,
    activeTenant,
  };
}

export async function resolveAcademyIdentity(
  repository: AcademyIdentityRepository,
  externalSubject: string,
  asOf = new Date().toISOString(),
): Promise<AcademyActor> {
  const identities = await repository.findActiveIdentities(externalSubject, asOf);

  if (identities.length === 0) {
    throw new AcademyAuthenticationError();
  }

  const tenantIds = new Set(identities.map((identity) => identity.tenantId));
  if (tenantIds.size !== 1) {
    throw new AcademyAuthenticationError(
      "The account is linked to multiple active Academy tenants.",
    );
  }

  const personIds = new Set(identities.map((identity) => identity.personId));
  if (personIds.size !== 1) {
    throw new AcademyAuthenticationError(
      "The account has ambiguous Academy person links.",
    );
  }

  const roles = [
    ...new Set(identities.flatMap((identity) => identity.roles)),
  ];
  if (roles.length === 0) {
    throw new AcademyAuthenticationError(
      "The account does not have an active Academy role.",
    );
  }

  return {
    userId: identities[0].personId,
    tenantId: identities[0].tenantId,
    roles,
  };
}
