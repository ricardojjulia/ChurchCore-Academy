import { InstitutionProfile, LmsSelectionStatus } from "@/modules/academy-config/types";
import {
  LmsCapability,
  LmsConfigurationStatus,
  LmsProviderDescriptor,
  LmsTenantContext,
  lmsProviderDescriptors,
  providerSupportsLmsCapability,
} from "./contract";
import { NoLmsProvider, noLmsProvider } from "./no-lms-provider";

export interface ResolveTenantLmsProviderInput {
  tenantId: string;
  correlationId: string;
}

export interface ResolvedTenantLmsProvider {
  tenant: LmsTenantContext;
  descriptor: LmsProviderDescriptor;
  provider?: NoLmsProvider;
  warnings: string[];
  supports(capability: LmsCapability): boolean;
}

function statusFor(selectionStatus: LmsSelectionStatus): LmsConfigurationStatus {
  switch (selectionStatus) {
    case "active":
      return "configured";
    case "paused":
      return "paused";
    case "migration_required":
      return "needs_review";
    case "planned":
    case "not_needed":
      return "not_configured";
  }
}

function warningsFor(selectionStatus: LmsSelectionStatus, providerLabel: string) {
  switch (selectionStatus) {
    case "planned":
      return [`${providerLabel} is planned but not active for this tenant.`];
    case "paused":
      return [`${providerLabel} is paused for this tenant.`];
    case "migration_required":
      return [`${providerLabel} requires migration review before use.`];
    case "active":
    case "not_needed":
      return [];
  }
}

function descriptorFor(profile: InstitutionProfile): LmsProviderDescriptor {
  const providerId = profile.lmsPreference.provider === "unconfigured" ? "none" : profile.lmsPreference.provider;
  const descriptor = lmsProviderDescriptors.find((candidate) => candidate.id === providerId);

  if (!descriptor) {
    throw new Error(`Unsupported LMS provider: ${profile.lmsPreference.provider}`);
  }

  if (providerId === "none") {
    return { ...descriptor, configurationStatus: "configured" };
  }

  return {
    ...descriptor,
    configurationStatus: statusFor(profile.lmsPreference.selectionStatus),
  };
}

export function resolveTenantLmsProvider(
  profile: InstitutionProfile,
  input: ResolveTenantLmsProviderInput,
): ResolvedTenantLmsProvider {
  if (profile.tenantId !== input.tenantId) {
    throw new Error("Cannot resolve LMS provider across tenants.");
  }

  const descriptor = descriptorFor(profile);
  const tenant: LmsTenantContext = {
    tenantId: profile.tenantId,
    institutionMode: profile.primaryMode,
    supportedModes: profile.supportedModes,
    providerId: descriptor.id,
    correlationId: input.correlationId,
  };
  const provider = descriptor.id === "none" ? noLmsProvider : undefined;
  const configured = descriptor.configurationStatus === "configured";
  const warnings = [
    ...descriptor.operationalWarnings,
    ...warningsFor(profile.lmsPreference.selectionStatus, descriptor.displayName),
  ];

  return {
    tenant,
    descriptor,
    provider,
    warnings,
    supports(capability) {
      return configured && providerSupportsLmsCapability(descriptor, capability);
    },
  };
}
