export type ConcreteInstitutionMode =
  | "bible_school"
  | "seminary"
  | "college"
  | "university"
  | "childrens_school"
  | "youth_seminary"
  | "ministry_training_center"
  | "continuing_education"
  | "homeschool_hybrid";

export type InstitutionMode = ConcreteInstitutionMode | "mixed";
export type InstitutionModel = "single_mode" | "multi_mode";

export type CalendarSystem = "school_year" | "academic_year" | "rolling_enrollment";
export type TermStructure = "semester" | "quarter" | "trimester" | "module" | "year_round" | "custom";
export type InstructionalRoleLabel = "teacher" | "professor" | "instructor" | "faculty";
export type OfficialRecordName = "transcript" | "progress_record" | "completion_record";
export type LmsProvider = "none" | "moodle" | "canvas" | "unconfigured";
export type LmsSelectionStatus = "not_needed" | "planned" | "active" | "paused" | "migration_required";

export interface InstitutionOperatingRules {
  academicYearLabel: string;
  defaultCalendarSystem: CalendarSystem;
  defaultTermStructure: TermStructure;
  usesGradeLevels: boolean;
  usesPrograms: boolean;
  usesCohorts: boolean;
  usesCredits: boolean;
  usesClockHours: boolean;
  usesGpa: boolean;
  usesTranscripts: boolean;
  usesGuardians: boolean;
  allowsMinors: boolean;
  defaultInstructionalRoleLabel: InstructionalRoleLabel;
  officialRecordName: OfficialRecordName;
}

export interface InstitutionCapabilitySet {
  studentPwa: boolean;
  guardianPortal: boolean;
  facultyPortal: boolean;
  registrarWorkflows: boolean;
  admissionsWorkflows: boolean;
  transcriptWorkflows: boolean;
  graduationWorkflows: boolean;
  lmsLaunch: boolean;
  lmsRosterSync: boolean;
  lmsGradeReturn: boolean;
  shepherdAiRecommendations: boolean;
  covenantRecords: boolean;
}

export interface InstitutionModePack {
  mode: ConcreteInstitutionMode;
  label: string;
  description: string;
  operatingRules: InstitutionOperatingRules;
  capabilities: InstitutionCapabilitySet;
  recommendedSubdivisionTypes: string[];
  workflowTemplates: string[];
}

export interface InstitutionLmsPreference {
  provider: LmsProvider;
  selectionStatus: LmsSelectionStatus;
  notes?: string;
}

export interface InstitutionProfile {
  tenantId: string;
  institutionName: string;
  legalName: string;
  primaryMode: InstitutionMode;
  supportedModes: InstitutionMode[];
  operatingRules: InstitutionOperatingRules;
  capabilities: InstitutionCapabilitySet;
  lmsPreference: InstitutionLmsPreference;
  createdAt: string;
  updatedAt: string;
}
