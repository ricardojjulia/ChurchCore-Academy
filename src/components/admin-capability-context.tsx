"use client";

import { createContext, useContext } from "react";

interface AdminCapabilityContextValue {
  ministryFormationEnabled: boolean;
  denominationTrackingEnabled: boolean;
  alumniGivingEnabled: boolean;
  canReadShepherdAi: boolean;
  canManageDripSequences: boolean;
  canReadInquiryPipeline: boolean;
  canViewDocumentTypes: boolean;
}

// Default matters: AdminShell is also used by pages outside src/app/admin/* (e.g.
// /settings/demo-feedback, deliberately placed outside the Academy admin gate since it's a
// platform-staff workspace, not an Academy one) which are never wrapped in
// AdminCapabilityProvider. Those pages have no ministry-formation/denomination/alumni nav items
// to gate anyway, so falling back to "disabled" here is correct — and it's what keeps those
// pages from crashing instead of rendering.
const defaultAdminCapabilities: AdminCapabilityContextValue = {
  ministryFormationEnabled: false,
  denominationTrackingEnabled: false,
  alumniGivingEnabled: false,
  canReadShepherdAi: false,
  canManageDripSequences: false,
  canReadInquiryPipeline: false,
  canViewDocumentTypes: false,
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
  canViewDocumentTypes,
}: {
  children: React.ReactNode;
  ministryFormationEnabled: boolean;
  denominationTrackingEnabled: boolean;
  alumniGivingEnabled: boolean;
  canReadShepherdAi: boolean;
  canManageDripSequences: boolean;
  canReadInquiryPipeline: boolean;
  canViewDocumentTypes: boolean;
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
        canViewDocumentTypes,
      }}
    >
      {children}
    </AdminCapabilityContext.Provider>
  );
}

export function useAdminCapabilities() {
  return useContext(AdminCapabilityContext);
}
