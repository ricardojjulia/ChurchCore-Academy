"use client";

import { createContext, useContext } from "react";

interface AdminCapabilityContextValue {
  ministryFormationEnabled: boolean;
  denominationTrackingEnabled: boolean;
  alumniGivingEnabled: boolean;
  canReadShepherdAi: boolean;
  canManageDripSequences: boolean;
  canReadInquiryPipeline: boolean;
  canReadInstitutionConfig: boolean;
  canReadLmsProviderReadiness: boolean;
}

// Default matters: AdminShell is also used by pages outside src/app/admin/* (e.g.
// /settings/demo-feedback, deliberately placed outside the Academy admin gate since it's a
// platform-staff workspace, not an Academy one) which are never wrapped in
// AdminCapabilityProvider (as are the /guardian/* pages). Their actors can't open any of the
// gated destinations — including the System settings pages — so falling back to "disabled"
// here is correct, and it's what keeps those pages from crashing instead of rendering.
const defaultAdminCapabilities: AdminCapabilityContextValue = {
  ministryFormationEnabled: false,
  denominationTrackingEnabled: false,
  alumniGivingEnabled: false,
  canReadShepherdAi: false,
  canManageDripSequences: false,
  canReadInquiryPipeline: false,
  canReadInstitutionConfig: false,
  canReadLmsProviderReadiness: false,
};

const AdminCapabilityContext = createContext<AdminCapabilityContextValue>(defaultAdminCapabilities);

export function AdminCapabilityProvider({
  children,
  ministryFormationEnabled,
  denominationTrackingEnabled,
  alumniGivingEnabled,
  canReadShepherdAi,
  canManageDripSequences,
  canReadInquiryPipeline,
  canReadInstitutionConfig,
  canReadLmsProviderReadiness,
}: {
  children: React.ReactNode;
  ministryFormationEnabled: boolean;
  denominationTrackingEnabled: boolean;
  alumniGivingEnabled: boolean;
  canReadShepherdAi: boolean;
  canManageDripSequences: boolean;
  canReadInquiryPipeline: boolean;
  canReadInstitutionConfig: boolean;
  canReadLmsProviderReadiness: boolean;
}) {
  return (
    <AdminCapabilityContext.Provider
      value={{
        ministryFormationEnabled,
        denominationTrackingEnabled,
        alumniGivingEnabled,
        canReadShepherdAi,
        canManageDripSequences,
        canReadInquiryPipeline,
        canReadInstitutionConfig,
        canReadLmsProviderReadiness,
      }}
    >
      {children}
    </AdminCapabilityContext.Provider>
  );
}

export function useAdminCapabilities() {
  return useContext(AdminCapabilityContext);
}
