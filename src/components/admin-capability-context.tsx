"use client";

import { createContext, useContext } from "react";

interface AdminCapabilityContextValue {
  ministryFormationEnabled: boolean;
}

// Default matters: AdminShell is also used by pages outside src/app/admin/* (e.g.
// /settings/demo-feedback, deliberately placed outside the Academy admin gate since it's a
// platform-staff workspace, not an Academy one) which are never wrapped in
// AdminCapabilityProvider. Those pages have no ministry-formation nav item to gate anyway, so
// falling back to "disabled" here is correct — and it's what keeps those pages from crashing
// instead of rendering.
const defaultAdminCapabilities: AdminCapabilityContextValue = { ministryFormationEnabled: false };

const AdminCapabilityContext = createContext<AdminCapabilityContextValue>(defaultAdminCapabilities);

export function AdminCapabilityProvider({
  children,
  ministryFormationEnabled,
}: {
  children: React.ReactNode;
  ministryFormationEnabled: boolean;
}) {
  return (
    <AdminCapabilityContext.Provider value={{ ministryFormationEnabled }}>
      {children}
    </AdminCapabilityContext.Provider>
  );
}

export function useAdminCapabilities() {
  return useContext(AdminCapabilityContext);
}
