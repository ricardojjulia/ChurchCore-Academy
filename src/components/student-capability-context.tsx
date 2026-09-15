"use client";

import { createContext, useContext } from "react";

interface StudentCapabilityContextValue {
  ministryFormationEnabled: boolean;
}

const StudentCapabilityContext = createContext<StudentCapabilityContextValue | null>(null);

export function StudentCapabilityProvider({
  children,
  ministryFormationEnabled,
}: {
  children: React.ReactNode;
  ministryFormationEnabled: boolean;
}) {
  return (
    <StudentCapabilityContext.Provider value={{ ministryFormationEnabled }}>
      {children}
    </StudentCapabilityContext.Provider>
  );
}

export function useStudentCapabilities() {
  const context = useContext(StudentCapabilityContext);
  if (!context) {
    throw new Error("useStudentCapabilities must be used within StudentCapabilityProvider");
  }
  return context;
}
