import {
  PlatformAdminRepository,
  PlatformProvisionedTenant,
  PlatformTenantLifecycleStatus,
  PlatformTenantProvisioningInput,
  PlatformTenantSelection,
} from "@/modules/platform-admin/types";
import { PlatformRole } from "@/modules/academy-auth/policy";

export interface CreatePlatformTenantInput {
  externalSubject: string;
  platformRoles: PlatformRole[];
  tenantId: string;
  displayName: string;
  institutionName?: string;
  legalName?: string;
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
  lifecycleStatus?: PlatformTenantLifecycleStatus;
  isDemo?: boolean;
  initialInstitutionAdmin: {
    displayName: string;
    givenName?: string;
    familyName?: string;
    email?: string;
  };
}

const tenantIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function sanitizeRequired(value: string, fieldName: string) {
  const sanitized = value.trim();
  if (!sanitized) {
    throw new Error(`${fieldName} is required.`);
  }
  return sanitized;
}

function normalizeLifecycleStatus(
  requested: PlatformTenantLifecycleStatus | undefined,
  isDemo: boolean,
): PlatformTenantLifecycleStatus {
  if (isDemo) {
    return "demo";
  }
  return requested ?? "development";
}

export class PlatformAdminService {
  constructor(private readonly repository: PlatformAdminRepository) {}

  async saveActiveTenantSelection(selection: PlatformTenantSelection) {
    await this.repository.saveActiveTenantSelection(selection);
  }

  async createTenant(input: CreatePlatformTenantInput): Promise<PlatformProvisionedTenant> {
    if (!input.platformRoles.includes("platform_admin")) {
      throw new Error("Forbidden platform admin access.");
    }

    const tenantId = sanitizeRequired(input.tenantId, "tenantId").toLowerCase();
    if (!tenantIdPattern.test(tenantId)) {
      throw new Error("Invalid tenantId format.");
    }

    const displayName = sanitizeRequired(input.displayName, "displayName");
    const institutionName = input.institutionName?.trim() || displayName;
    const legalName = input.legalName?.trim() || institutionName;
    const initialAdminDisplayName = sanitizeRequired(
      input.initialInstitutionAdmin.displayName,
      "initialInstitutionAdmin.displayName",
    );
    const isDemo = Boolean(input.isDemo);
    const lifecycleStatus = normalizeLifecycleStatus(input.lifecycleStatus, isDemo);

    const provisioningInput: PlatformTenantProvisioningInput = {
      externalSubject: input.externalSubject,
      tenantId,
      displayName,
      institutionName,
      legalName,
      primaryMode: input.primaryMode,
      supportedModes: input.supportedModes,
      lifecycleStatus,
      isDemo,
      initialInstitutionAdmin: {
        displayName: initialAdminDisplayName,
        givenName: input.initialInstitutionAdmin.givenName?.trim() || undefined,
        familyName: input.initialInstitutionAdmin.familyName?.trim() || undefined,
        email: input.initialInstitutionAdmin.email?.trim().toLowerCase() || undefined,
      },
    };

    return this.repository.provisionTenant(provisioningInput);
  }
}