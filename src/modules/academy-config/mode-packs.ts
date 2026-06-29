import {
  ConcreteInstitutionMode,
  InstitutionCapabilitySet,
  InstitutionMode,
  InstitutionModePack,
  InstitutionModel,
  InstitutionOperatingRules,
} from "@/modules/academy-config/types";

export const concreteInstitutionModes = [
  "bible_school",
  "seminary",
  "college",
  "university",
  "childrens_school",
  "youth_seminary",
  "ministry_training_center",
  "continuing_education",
  "homeschool_hybrid",
] as const satisfies readonly ConcreteInstitutionMode[];

const concreteModeSet = new Set<InstitutionMode>(concreteInstitutionModes);

const baseCapabilities: InstitutionCapabilitySet = {
  studentPwa: true,
  guardianPortal: false,
  facultyPortal: true,
  registrarWorkflows: true,
  admissionsWorkflows: true,
  transcriptWorkflows: false,
  graduationWorkflows: false,
  lmsLaunch: false,
  lmsRosterSync: false,
  lmsGradeReturn: false,
  shepherdAiRecommendations: true,
};

const collegeOperatingRules: InstitutionOperatingRules = {
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

const modePacks: Record<ConcreteInstitutionMode, InstitutionModePack> = {
  bible_school: {
    mode: "bible_school",
    label: "Bible school",
    description: "Certificate and ministry-formation programs using cohorts, modules, and completion records.",
    operatingRules: {
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
    },
    capabilities: baseCapabilities,
    recommendedSubdivisionTypes: ["school", "cohort"],
    workflowTemplates: ["certificate_admissions", "cohort_enrollment", "completion_review"],
  },
  seminary: {
    mode: "seminary",
    label: "Seminary",
    description: "Postsecondary ministry education using credits, GPA, transcripts, and graduation workflows.",
    operatingRules: collegeOperatingRules,
    capabilities: {
      ...baseCapabilities,
      transcriptWorkflows: true,
      graduationWorkflows: true,
    },
    recommendedSubdivisionTypes: ["school", "department"],
    workflowTemplates: ["degree_admissions", "registration", "transcript_posting", "graduation_audit"],
  },
  college: {
    mode: "college",
    label: "College",
    description: "College-style academic programs using credits, GPA, transcripts, and registrar workflows.",
    operatingRules: collegeOperatingRules,
    capabilities: {
      ...baseCapabilities,
      transcriptWorkflows: true,
      graduationWorkflows: true,
    },
    recommendedSubdivisionTypes: ["school", "department"],
    workflowTemplates: ["degree_admissions", "registration", "transcript_posting", "graduation_audit"],
  },
  university: {
    mode: "university",
    label: "University",
    description: "University-style multi-school academic operations with departments, credits, and transcripts.",
    operatingRules: {
      ...collegeOperatingRules,
      defaultInstructionalRoleLabel: "faculty",
    },
    capabilities: {
      ...baseCapabilities,
      transcriptWorkflows: true,
      graduationWorkflows: true,
    },
    recommendedSubdivisionTypes: ["school", "department", "division"],
    workflowTemplates: ["degree_admissions", "registration", "transcript_posting", "graduation_audit"],
  },
  childrens_school: {
    mode: "childrens_school",
    label: "Children's school",
    description: "K-12 or children's education using school-year calendars, grade levels, guardians, and progress records.",
    operatingRules: {
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
    },
    capabilities: {
      ...baseCapabilities,
      guardianPortal: true,
    },
    recommendedSubdivisionTypes: ["school", "grade_band"],
    workflowTemplates: ["guardian_onboarding", "grade_band_enrollment", "progress_reporting"],
  },
  youth_seminary: {
    mode: "youth_seminary",
    label: "Youth seminary",
    description: "Youth ministry formation programs with guardian support and progress or completion records.",
    operatingRules: {
      academicYearLabel: "Ministry Year",
      defaultCalendarSystem: "academic_year",
      defaultTermStructure: "module",
      usesGradeLevels: false,
      usesPrograms: true,
      usesCohorts: true,
      usesCredits: false,
      usesClockHours: true,
      usesGpa: false,
      usesTranscripts: false,
      usesGuardians: true,
      allowsMinors: true,
      defaultInstructionalRoleLabel: "instructor",
      officialRecordName: "progress_record",
    },
    capabilities: {
      ...baseCapabilities,
      guardianPortal: true,
    },
    recommendedSubdivisionTypes: ["school", "cohort"],
    workflowTemplates: ["guardian_onboarding", "cohort_enrollment", "formation_progress_review"],
  },
  ministry_training_center: {
    mode: "ministry_training_center",
    label: "Ministry training center",
    description: "Clock-hour or module-based leadership training with completion records.",
    operatingRules: {
      academicYearLabel: "Training Year",
      defaultCalendarSystem: "rolling_enrollment",
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
    },
    capabilities: baseCapabilities,
    recommendedSubdivisionTypes: ["division", "cohort"],
    workflowTemplates: ["training_intake", "module_enrollment", "completion_review"],
  },
  continuing_education: {
    mode: "continuing_education",
    label: "Continuing education",
    description: "Non-degree continuing education using rolling enrollment, modules, and completion records.",
    operatingRules: {
      academicYearLabel: "Learning Year",
      defaultCalendarSystem: "rolling_enrollment",
      defaultTermStructure: "module",
      usesGradeLevels: false,
      usesPrograms: true,
      usesCohorts: false,
      usesCredits: false,
      usesClockHours: true,
      usesGpa: false,
      usesTranscripts: false,
      usesGuardians: false,
      allowsMinors: false,
      defaultInstructionalRoleLabel: "instructor",
      officialRecordName: "completion_record",
    },
    capabilities: baseCapabilities,
    recommendedSubdivisionTypes: ["division", "cohort"],
    workflowTemplates: ["open_registration", "module_enrollment", "completion_review"],
  },
  homeschool_hybrid: {
    mode: "homeschool_hybrid",
    label: "Homeschool hybrid",
    description: "Hybrid school/co-op operations with grade bands, guardians, and progress records.",
    operatingRules: {
      academicYearLabel: "School Year",
      defaultCalendarSystem: "school_year",
      defaultTermStructure: "year_round",
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
    },
    capabilities: {
      ...baseCapabilities,
      guardianPortal: true,
    },
    recommendedSubdivisionTypes: ["school", "grade_band", "cohort"],
    workflowTemplates: ["guardian_onboarding", "grade_band_enrollment", "progress_reporting"],
  },
};

export function isConcreteInstitutionMode(mode: InstitutionMode | string): mode is ConcreteInstitutionMode {
  return concreteModeSet.has(mode as InstitutionMode) && mode !== "mixed";
}

export function getInstitutionModePack(mode: ConcreteInstitutionMode): InstitutionModePack {
  return modePacks[mode];
}

export function normalizeSelectedInstitutionModes(modes: readonly InstitutionMode[] | undefined): ConcreteInstitutionMode[] {
  const concreteModes = (modes ?? [])
    .filter(isConcreteInstitutionMode)
    .filter((mode, index, values) => values.indexOf(mode) === index);

  return concreteModes.length > 0 ? concreteModes : ["college"];
}

export function resolveConcretePrimaryMode(
  primaryMode: InstitutionMode,
  selectedModes: readonly InstitutionMode[] | undefined,
): ConcreteInstitutionMode {
  if (isConcreteInstitutionMode(primaryMode)) {
    return primaryMode;
  }

  return normalizeSelectedInstitutionModes(selectedModes)[0];
}

export function resolveInstitutionModel(selectedModes: readonly InstitutionMode[]): InstitutionModel {
  return normalizeSelectedInstitutionModes(selectedModes).length > 1 ? "multi_mode" : "single_mode";
}

function chooseCalendarSystem(packs: InstitutionModePack[]) {
  if (packs.some((pack) => pack.operatingRules.defaultCalendarSystem === "academic_year")) return "academic_year";
  if (packs.some((pack) => pack.operatingRules.defaultCalendarSystem === "school_year")) return "school_year";
  return packs[0].operatingRules.defaultCalendarSystem;
}

function chooseTermStructure(packs: InstitutionModePack[]) {
  if (packs.some((pack) => pack.operatingRules.defaultTermStructure === "semester")) return "semester";
  if (packs.some((pack) => pack.operatingRules.defaultTermStructure === "trimester")) return "trimester";
  return packs[0].operatingRules.defaultTermStructure;
}

function chooseOfficialRecordName(packs: InstitutionModePack[]) {
  if (packs.some((pack) => pack.operatingRules.officialRecordName === "transcript")) return "transcript";
  if (packs.some((pack) => pack.operatingRules.officialRecordName === "progress_record")) return "progress_record";
  return "completion_record";
}

function chooseInstructionalRoleLabel(packs: InstitutionModePack[]) {
  if (packs.some((pack) => pack.operatingRules.defaultInstructionalRoleLabel === "faculty")) return "faculty";
  if (packs.some((pack) => pack.operatingRules.defaultInstructionalRoleLabel === "professor")) return "professor";
  if (packs.some((pack) => pack.operatingRules.defaultInstructionalRoleLabel === "teacher")) return "teacher";
  return "instructor";
}

export function aggregateModePackOperatingRules(selectedModes: readonly InstitutionMode[]): InstitutionOperatingRules {
  const packs = normalizeSelectedInstitutionModes(selectedModes).map(getInstitutionModePack);

  return {
    academicYearLabel: packs.some((pack) => pack.operatingRules.defaultCalendarSystem === "school_year")
      ? "School / Academic Year"
      : packs[0].operatingRules.academicYearLabel,
    defaultCalendarSystem: chooseCalendarSystem(packs),
    defaultTermStructure: chooseTermStructure(packs),
    usesGradeLevels: packs.some((pack) => pack.operatingRules.usesGradeLevels),
    usesPrograms: packs.some((pack) => pack.operatingRules.usesPrograms),
    usesCohorts: packs.some((pack) => pack.operatingRules.usesCohorts),
    usesCredits: packs.some((pack) => pack.operatingRules.usesCredits),
    usesClockHours: packs.some((pack) => pack.operatingRules.usesClockHours),
    usesGpa: packs.some((pack) => pack.operatingRules.usesGpa),
    usesTranscripts: packs.some((pack) => pack.operatingRules.usesTranscripts),
    usesGuardians: packs.some((pack) => pack.operatingRules.usesGuardians),
    allowsMinors: packs.some((pack) => pack.operatingRules.allowsMinors),
    defaultInstructionalRoleLabel: chooseInstructionalRoleLabel(packs),
    officialRecordName: chooseOfficialRecordName(packs),
  };
}

export function aggregateModePackCapabilities(selectedModes: readonly InstitutionMode[]): InstitutionCapabilitySet {
  const packs = normalizeSelectedInstitutionModes(selectedModes).map(getInstitutionModePack);

  const initialCapabilities: InstitutionCapabilitySet = {
    ...baseCapabilities,
    studentPwa: false,
    facultyPortal: false,
    registrarWorkflows: false,
    admissionsWorkflows: false,
    shepherdAiRecommendations: false,
  };

  return packs.reduce<InstitutionCapabilitySet>(
    (capabilities, pack) => ({
      studentPwa: capabilities.studentPwa || pack.capabilities.studentPwa,
      guardianPortal: capabilities.guardianPortal || pack.capabilities.guardianPortal,
      facultyPortal: capabilities.facultyPortal || pack.capabilities.facultyPortal,
      registrarWorkflows: capabilities.registrarWorkflows || pack.capabilities.registrarWorkflows,
      admissionsWorkflows: capabilities.admissionsWorkflows || pack.capabilities.admissionsWorkflows,
      transcriptWorkflows: capabilities.transcriptWorkflows || pack.capabilities.transcriptWorkflows,
      graduationWorkflows: capabilities.graduationWorkflows || pack.capabilities.graduationWorkflows,
      lmsLaunch: capabilities.lmsLaunch || pack.capabilities.lmsLaunch,
      lmsRosterSync: capabilities.lmsRosterSync || pack.capabilities.lmsRosterSync,
      lmsGradeReturn: capabilities.lmsGradeReturn || pack.capabilities.lmsGradeReturn,
      shepherdAiRecommendations: capabilities.shepherdAiRecommendations || pack.capabilities.shepherdAiRecommendations,
    }),
    initialCapabilities,
  );
}
