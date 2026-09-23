export type GraduationClearanceStatus = "pending" | "cleared" | "deferred";

export interface GraduationClearance {
  id: string;
  tenantId: string;
  studentProfileId: string;
  academicProgramId: string;
  academicYearId: string;
  status: GraduationClearanceStatus;
  initiatedByPersonId: string;
  initiatedAt: string;
  clearedByPersonId?: string;
  clearedAt?: string;
  deferredReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InitiateClearanceInput {
  studentProfileId: string;
  academicProgramId: string;
  academicYearId: string;
}

export interface UpdateClearanceInput {
  clearanceId: string;
  action: "clear" | "defer";
  notes?: string;
  deferredReason?: string;
}

export interface GraduationClearanceRepository {
  create(
    tenantId: string,
    initiatedByPersonId: string,
    input: InitiateClearanceInput,
  ): Promise<GraduationClearance>;
  update(
    tenantId: string,
    clearedByPersonId: string,
    input: UpdateClearanceInput,
  ): Promise<GraduationClearance>;
  findByStudent(
    tenantId: string,
    studentProfileId: string,
  ): Promise<GraduationClearance | undefined>;
  findById(
    tenantId: string,
    clearanceId: string,
  ): Promise<GraduationClearance | undefined>;
}
