"use client";

import { createContext, useContext } from "react";

interface AdminCapabilityContextValue {
  ministryFormationEnabled: boolean;
}

const AdminCapabilityContext = createContext<AdminCapabilityContextValue | null>(null);

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
  const context = useContext(AdminCapabilityContext);
  if (!context) {
    throw new Error("useAdminCapabilities must be used within AdminCapabilityProvider");
  }
  return context;
}
