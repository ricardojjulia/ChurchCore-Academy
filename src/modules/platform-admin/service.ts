import {
  PlatformAdminRepository,
  PlatformProvisionedTenant,
  PlatformTenantLifecycleStatus,
  PlatformTenantProvisioningInput,
  PlatformTenantSelection,
} from "@/modules/platform-admin/types";
import { PlatformRole } from "@/modules/academy-auth/policy";
import { isConcreteInstitutionMode, normalizeSelectedInstitutionModes } from "@/modules/academy-config/mode-packs";
import type { ConcreteInstitutionMode, InstitutionMode } from "@/modules/academy-config/types";

export interface CreatePlatformTenantInput {
  externalSubject: string;
  platformRoles: PlatformRole[];
  tenantId: string;
  displayName: string;
  institutionName?: string;
  legalName?: string;
  primaryMode?: InstitutionMode;
  selectedModes?: InstitutionMode[];
  supportedModes?: InstitutionMode[];
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

function normalizeProvisioningModes(input: CreatePlatformTenantInput): {
  primaryMode: ConcreteInstitutionMode;
  supportedModes: ConcreteInstitutionMode[];
} {
  const requestedModes = input.selectedModes ?? input.supportedModes ?? (input.primaryMode ? [input.primaryMode] : undefined);
  if (requestedModes?.includes("mixed")) {
    throw new Error("Invalid institution mode selection: mixed is derived from selected concrete modes.");
  }

  const supportedModes = normalizeSelectedInstitutionModes(requestedModes);
  const requestedPrimary = input.primaryMode && isConcreteInstitutionMode(input.primaryMode)
    ? input.primaryMode
    : supportedModes[0];
  const primaryMode = supportedModes.includes(requestedPrimary) ? requestedPrimary : supportedModes[0];

  return { primaryMode, supportedModes };
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
    const modes = normalizeProvisioningModes(input);

    const provisioningInput: PlatformTenantProvisioningInput = {
      externalSubject: input.externalSubject,
      tenantId,
      displayName,
      institutionName,
      legalName,
      primaryMode: modes.primaryMode,
      supportedModes: modes.supportedModes,
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
