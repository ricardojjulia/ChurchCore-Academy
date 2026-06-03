import { InstitutionMode, InstitutionOperatingRules, InstitutionProfile, LmsProvider } from "@/modules/academy-config/types";

interface CreateInstitutionProfileInput {
  tenantId: string;
  institutionName: string;
  legalName: string;
  primaryMode: InstitutionMode;
  supportedModes?: InstitutionMode[];
  lmsProvider?: LmsProvider;
  now?: string;
}

const nowDefault = "2026-06-01T00:00:00.000Z";

const postsecondaryModes = new Set<InstitutionMode>(["seminary", "college", "university"]);

function concreteModes(modes: InstitutionMode[]) {
  return modes.filter((mode) => mode !== "mixed");
}

function resolveConcretePrimaryMode(primaryMode: InstitutionMode, supportedModes: InstitutionMode[]) {
  if (primaryMode !== "mixed") {
    return primaryMode;
  }

  return concreteModes(supportedModes)[0] ?? "college";
}

function operatingRulesFor(mode: InstitutionMode): InstitutionOperatingRules {
  switch (mode) {
    case "bible_school":
      return {
        academicYearLabel: "Academic Year",
        defaultCalendarSystem: "academic_year",
        defaultTermStructure: "module",
        usesGradeLevels: false,
        usesPrograms: true,
        usesCohorts: true,
        usesCredits: false,
        usesClockHours: true,
        usesGpa: false,
        usesTranscripts: false,
        usesGuardians: false,
        allowsMinors: false,
        defaultInstructionalRoleLabel: "instructor",
        officialRecordName: "completion_record",
      };
    case "childrens_school":
      return {
        academicYearLabel: "School Year",
        defaultCalendarSystem: "school_year",
        defaultTermStructure: "trimester",
        usesGradeLevels: true,
        usesPrograms: false,
        usesCohorts: true,
        usesCredits: false,
        usesClockHours: false,
        usesGpa: false,
        usesTranscripts: false,
        usesGuardians: true,
        allowsMinors: true,
        defaultInstructionalRoleLabel: "teacher",
        officialRecordName: "progress_record",
      };
    case "seminary":
      return {
        academicYearLabel: "Academic Year",
        defaultCalendarSystem: "academic_year",
        defaultTermStructure: "semester",
        usesGradeLevels: false,
        usesPrograms: true,
        usesCohorts: true,
        usesCredits: true,
        usesClockHours: false,
        usesGpa: true,
        usesTranscripts: true,
        usesGuardians: false,
        allowsMinors: false,
        defaultInstructionalRoleLabel: "professor",
        officialRecordName: "transcript",
      };
    case "university":
      return {
        ...operatingRulesFor("college"),
        defaultInstructionalRoleLabel: "faculty",
      };
    case "mixed":
    case "college":
      return {
        academicYearLabel: "Academic Year",
        defaultCalendarSystem: "academic_year",
        defaultTermStructure: "semester",
        usesGradeLevels: false,
        usesPrograms: true,
        usesCohorts: true,
        usesCredits: true,
        usesClockHours: false,
        usesGpa: true,
        usesTranscripts: true,
        usesGuardians: false,
        allowsMinors: false,
        defaultInstructionalRoleLabel: "professor",
        officialRecordName: "transcript",
      };
  }
}

export function createInstitutionProfileDefaults(input: CreateInstitutionProfileInput): InstitutionProfile {
  const supportedModes = input.supportedModes?.length ? input.supportedModes : [input.primaryMode];
  const concretePrimaryMode = resolveConcretePrimaryMode(input.primaryMode, supportedModes);
  const operatingRules = operatingRulesFor(concretePrimaryMode);
  const lmsProvider = input.lmsProvider ?? "none";
  const hasLmsProvider = lmsProvider === "moodle" || lmsProvider === "canvas";
  const isPostsecondary = concreteModes(supportedModes).some((mode) => postsecondaryModes.has(mode)) || postsecondaryModes.has(concretePrimaryMode);
  const timestamp = input.now ?? nowDefault;

  return {
    tenantId: input.tenantId,
    institutionName: input.institutionName,
    legalName: input.legalName,
    primaryMode: input.primaryMode,
    supportedModes,
    operatingRules,
    capabilities: {
      studentPwa: true,
      guardianPortal: operatingRules.usesGuardians,
      facultyPortal: true,
      registrarWorkflows: true,
      admissionsWorkflows: true,
      transcriptWorkflows: isPostsecondary && operatingRules.usesTranscripts,
      graduationWorkflows: isPostsecondary,
      lmsLaunch: hasLmsProvider,
      lmsRosterSync: hasLmsProvider,
      lmsGradeReturn: hasLmsProvider,
      shepherdAiRecommendations: true,
    },
    lmsPreference: {
      provider: lmsProvider,
      selectionStatus: hasLmsProvider ? "planned" : lmsProvider === "none" ? "not_needed" : "planned",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
