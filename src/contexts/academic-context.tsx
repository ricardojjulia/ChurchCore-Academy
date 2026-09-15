"use client";

import { createContext, useContext } from "react";

export interface AcademicContextData {
  context: {
    yearId: string | null;
    yearName: string | null;
    periodId: string | null;
    periodName: string | null;
  };
  years: Array<{ id: string; name: string; status: string }>;
  periods: Array<{ id: string; name: string; academicYearId: string }>;
}

const AcademicContextDataContext = createContext<AcademicContextData | null>(null);

export function AcademicContextDataProvider({
  value,
  children,
}: {
  value: AcademicContextData | null;
  children: React.ReactNode;
}) {
  return (
    <AcademicContextDataContext.Provider value={value}>
      {children}
    </AcademicContextDataContext.Provider>
  );
}

export function useAcademicContextData(): AcademicContextData | null {
  return useContext(AcademicContextDataContext);
}
