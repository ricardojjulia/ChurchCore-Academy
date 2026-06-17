export type ProgramInstitutionMode =
  | "bible_school"
  | "childrens_school"
  | "seminary"
  | "college"
  | "university"
  | "mixed";

export type ProgramCredentialType =
  | "certificate"
  | "diploma"
  | "associate"
  | "bachelor"
  | "master"
  | "doctorate"
  | "continuing_education"
  | "non_credit";

export type ProgramGradeBand =
  | "early_childhood"
  | "elementary"
  | "middle"
  | "high_school"
  | "undergraduate"
  | "graduate"
  | "adult"
  | "all_ages";

export type ProgramStatus = "draft" | "active" | "inactive" | "archived";

export interface AcademicProgram {
  id: string;
  tenantId: string;
  programCode: string;
  title: string;
  shortTitle?: string;
  description?: string;
  institutionMode: ProgramInstitutionMode;
  credentialType: ProgramCredentialType;
  gradeBand?: ProgramGradeBand;
  subdivisionId?: string;
  requiredCredits: number;
  requiredClockHours: number;
  requiredCompetencies: number;
  typicalDurationPeriods?: number;
  status: ProgramStatus;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdAt: string;
  createdByPersonId?: string;
  updatedAt: string;
}

export interface CreateAcademicProgramInput {
  tenantId: string;
  programCode: string;
  title: string;
  shortTitle?: string;
  description?: string;
  institutionMode: ProgramInstitutionMode;
  credentialType: ProgramCredentialType;
  gradeBand?: ProgramGradeBand;
  subdivisionId?: string;
  requiredCredits?: number;
  requiredClockHours?: number;
  requiredCompetencies?: number;
  typicalDurationPeriods?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdByPersonId?: string;
}

export interface UpdateAcademicProgramInput {
  title?: string;
  shortTitle?: string;
  description?: string;
  gradeBand?: ProgramGradeBand;
  subdivisionId?: string;
  requiredCredits?: number;
  requiredClockHours?: number;
  requiredCompetencies?: number;
  typicalDurationPeriods?: number;
  status?: ProgramStatus;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface AcademicProgramRepository {
  list(tenantId: string, filters?: { status?: ProgramStatus; institutionMode?: ProgramInstitutionMode }): Promise<AcademicProgram[]>;
  findById(tenantId: string, id: string): Promise<AcademicProgram | undefined>;
  findByCode(tenantId: string, programCode: string): Promise<AcademicProgram | undefined>;
  create(input: CreateAcademicProgramInput): Promise<AcademicProgram>;
  update(tenantId: string, id: string, input: UpdateAcademicProgramInput): Promise<AcademicProgram>;
}

export const PROGRAM_INSTITUTION_MODES: ProgramInstitutionMode[] = [
  "bible_school", "childrens_school", "seminary", "college", "university", "mixed",
];

export const PROGRAM_CREDENTIAL_TYPES: ProgramCredentialType[] = [
  "certificate", "diploma", "associate", "bachelor", "master", "doctorate",
  "continuing_education", "non_credit",
];

export function validateCreateProgramInput(input: Partial<CreateAcademicProgramInput>): CreateAcademicProgramInput {
  if (!input.tenantId?.trim()) throw new Error("tenantId is required.");
  if (!input.programCode?.trim()) throw new Error("programCode is required.");
  if (!input.title?.trim()) throw new Error("title is required.");
  if (!input.institutionMode || !(PROGRAM_INSTITUTION_MODES as string[]).includes(input.institutionMode)) {
    throw new Error(`institutionMode must be one of: ${PROGRAM_INSTITUTION_MODES.join(", ")}.`);
  }
  if (!input.credentialType || !(PROGRAM_CREDENTIAL_TYPES as string[]).includes(input.credentialType)) {
    throw new Error(`credentialType must be one of: ${PROGRAM_CREDENTIAL_TYPES.join(", ")}.`);
  }
  return {
    ...input,
    tenantId: input.tenantId,
    programCode: input.programCode.toUpperCase().trim(),
    title: input.title.trim(),
    institutionMode: input.institutionMode,
    credentialType: input.credentialType,
    requiredCredits: input.requiredCredits ?? 0,
    requiredClockHours: input.requiredClockHours ?? 0,
    requiredCompetencies: input.requiredCompetencies ?? 0,
  } as CreateAcademicProgramInput;
}
