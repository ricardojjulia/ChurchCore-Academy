import {
  createEmptyLmsReconciliationReport,
  createUnsupportedLmsOperationResult,
  LmsCapability,
  LmsLaunchRequest,
  LmsLaunchResponse,
  LmsOperationResult,
  LmsProviderDescriptor,
  LmsReconciliationReport,
  LmsTenantContext,
  lmsProviderDescriptors,
} from "./contract";

const noLmsUnavailableMessage = "This institution has not enabled an external LMS.";

const descriptor = lmsProviderDescriptors.find((provider) => provider.id === "none");

if (!descriptor) {
  throw new Error("No-LMS provider descriptor is not registered.");
}

export interface NoLmsProvider {
  descriptor: LmsProviderDescriptor;
  createLaunchResponse(request: LmsLaunchRequest): LmsLaunchResponse;
  unsupported(capability: LmsCapability, tenant: LmsTenantContext, operationId: string): LmsOperationResult;
  reconcile(tenant: LmsTenantContext): LmsReconciliationReport;
}

export const noLmsProvider: NoLmsProvider = {
  descriptor,

  createLaunchResponse(request) {
    return {
      status: "unavailable",
      displayLabel: "Learning",
      unavailableReason: noLmsUnavailableMessage,
      auditReference: `${request.tenant.correlationId}:none:identity_launch`,
    };
  },

  unsupported(capability, tenant, operationId) {
    return createUnsupportedLmsOperationResult({
      providerId: "none",
      capability,
      tenantId: tenant.tenantId,
      correlationId: tenant.correlationId,
      operationId,
      safeMessage: noLmsUnavailableMessage,
    });
  },

  reconcile(tenant) {
    return createEmptyLmsReconciliationReport(tenant.tenantId, "none", tenant.correlationId);
  },
};
