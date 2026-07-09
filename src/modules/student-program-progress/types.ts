export type StudentProgramProgressRequirementStatus = "completed" | "in_progress" | "not_started";

export interface StudentProgramProgressRequirement {
  requirementId: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  requirementType: string;
  requirementGroup: string;
  sequence: number;
  credits: number;
  minimumGrade?: string;
  status: StudentProgramProgressRequirementStatus;
  completedRegistrationId?: string;
  activeRegistrationId?: string;
  finalLetterGrade?: string;
  completedAt?: string;
}

export interface StudentProgramProgressSummary {
  studentProfileId: string;
  activeProgramMembershipId: string;
  academicProgramId: string;
  programCode?: string;
  programTitle?: string;
  catalogAcademicYearId: string;
  catalogAcademicYearName?: string;
  requiredCredits: number;
  completedCredits: number;
  inProgressCredits: number;
  remainingCredits: number;
  percentComplete: number;
  requirements: StudentProgramProgressRequirement[];
}

export interface StudentProgramProgressRepository {
  getProgress(tenantId: string, studentProfileId: string): Promise<StudentProgramProgressSummary | undefined>;
}
