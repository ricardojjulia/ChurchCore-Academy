"use client";

import { createContext, useCallback, useContext, useState } from "react";

export interface StudentContextValue {
  studentId: string | null;
  studentName: string | null;
  programName: string | null;
  enrollmentStatus: string | null;
  setStudent: (
    id: string,
    name: string,
    program: string,
    status: string,
  ) => void;
  clearStudent: () => void;
}

const StudentContext = createContext<StudentContextValue>({
  studentId: null,
  studentName: null,
  programName: null,
  enrollmentStatus: null,
  setStudent: () => {},
  clearStudent: () => {},
});

export function StudentContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [programName, setProgramName] = useState<string | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<string | null>(null);

  const setStudent = useCallback(
    (id: string, name: string, program: string, status: string) => {
      setStudentId(id);
      setStudentName(name);
      setProgramName(program);
      setEnrollmentStatus(status);
    },
    [],
  );

  const clearStudent = useCallback(() => {
    setStudentId(null);
    setStudentName(null);
    setProgramName(null);
    setEnrollmentStatus(null);
  }, []);

  return (
    <StudentContext.Provider
      value={{
        studentId,
        studentName,
        programName,
        enrollmentStatus,
        setStudent,
        clearStudent,
      }}
    >
      {children}
    </StudentContext.Provider>
  );
}

export function useStudentContext(): StudentContextValue {
  return useContext(StudentContext);
}
