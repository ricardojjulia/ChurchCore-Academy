export type ProgramCurriculumRequirementType = "required" | "elective" | "practicum" | "capstone";
export type ProgramCurriculumRequirementStatus = "active" | "archived";

export interface ProgramCurriculumRequirement {
  id: string;
  tenantId: string;
  academicProgramId: string;
  academicYearId: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  requirementType: ProgramCurriculumRequirementType;
  requirementGroup: string;
  sequence: number;
  credits: number;
  minimumGrade?: string;
  notes?: string;
  status: ProgramCurriculumRequirementStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramCurriculumRequirementInput {
  courseId: string;
  requirementType: ProgramCurriculumRequirementType;
  requirementGroup: string;
  sequence: number;
  credits: number;
  minimumGrade?: string;
  notes?: string;
}

export interface ReplaceProgramCurriculumInput {
  academicProgramId: string;
  academicYearId: string;
  requirements: ProgramCurriculumRequirementInput[];
}

export interface ProgramCurriculumRepository {
  listRequirements(
    tenantId: string,
    academicProgramId: string,
    academicYearId: string,
  ): Promise<ProgramCurriculumRequirement[]>;
  replaceRequirements(
    tenantId: string,
    academicProgramId: string,
    academicYearId: string,
    requirements: ProgramCurriculumRequirementInput[],
  ): Promise<ProgramCurriculumRequirement[]>;
}
