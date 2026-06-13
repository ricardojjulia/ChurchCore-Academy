import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import {
  AcademyActor,
  AcademyRole,
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
