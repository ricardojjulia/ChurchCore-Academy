export type StudentProgramMembershipStatus = "active" | "completed" | "withdrawn" | "cancelled";

export interface StudentProgramMembership {
  id: string;
  tenantId: string;
  studentProfileId: string;
  studentPersonId: string;
  academicProgramId: string;
  programCode?: string;
  programTitle?: string;
  catalogAcademicYearId: string;
  catalogAcademicYearName?: string;
  sourceApplicationId?: string;
  status: StudentProgramMembershipStatus;
  startedOn: string;
  endedOn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SetActiveStudentProgramMembershipInput {
  studentProfileId: string;
  academicProgramId: string;
  catalogAcademicYearId: string;
  startedOn?: string;
}

export interface StudentProgramMembershipRepository {
  listByStudent(tenantId: string, studentProfileId: string): Promise<StudentProgramMembership[]>;
  setActive(
    tenantId: string,
    input: Required<SetActiveStudentProgramMembershipInput>,
  ): Promise<StudentProgramMembership>;
}
