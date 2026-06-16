export interface PlatformTenantSelection {
  externalSubject: string;
  tenantId: string;
}

export interface PlatformTenantAdminSeed {
  displayName: string;
  givenName?: string;
  familyName?: string;
  email?: string;
}

export type PlatformTenantLifecycleStatus =
  | "demo"
  | "development"
  | "trial"
  | "active"
  | "suspended"
  | "archived";

export interface PlatformTenantProvisioningInput {
  externalSubject: string;
  tenantId: string;
  displayName: string;
  institutionName: string;
  legalName: string;
  primaryMode:
    | "bible_school"
    | "childrens_school"
    | "seminary"
    | "college"
    | "university"
    | "mixed";
  supportedModes?: Array<
    | "bible_school"
    | "childrens_school"
    | "seminary"
    | "college"
    | "university"
    | "mixed"
  >;
  lifecycleStatus: PlatformTenantLifecycleStatus;
  isDemo: boolean;
  initialInstitutionAdmin: PlatformTenantAdminSeed;
}

export interface PlatformProvisionedTenant {
  tenantId: string;
  displayName: string;
  lifecycleStatus: PlatformTenantLifecycleStatus;
  isDemo: boolean;
  provisioningStatus: "ready";
  initialAdminPersonId: string;
}

export interface PlatformAdminRepository {
  saveActiveTenantSelection(selection: PlatformTenantSelection): Promise<void>;
  provisionTenant(
    input: PlatformTenantProvisioningInput,
  ): Promise<PlatformProvisionedTenant>;
  deleteTenant(tenantId: string): Promise<void>;
}