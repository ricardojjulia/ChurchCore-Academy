import {
  getInstitutionModePack,
  normalizeSelectedInstitutionModes,
  resolveInstitutionModel,
} from "@/modules/academy-config/mode-packs";
import { InstitutionCapabilitySet, InstitutionOperatingRules, InstitutionProfile } from "@/modules/academy-config/types";
import { validateInstitutionProfile } from "@/modules/academy-config/validation";

export type ReviewStatus = "enabled" | "off";

export interface InstitutionReviewItem {
  label: string;
  value: string;
}

export interface InstitutionCapabilityReviewItem {
  label: string;
  status: ReviewStatus;
}

export interface InstitutionReviewModel {
  identity: {
    tenantId: string;
    institutionName: string;
    legalName: string;
    institutionModel: string;
    primaryMode: string;
    supportedModes: string[];
    modePacks: string[];
    updatedAt: string;
  };
  operatingRules: InstitutionReviewItem[];
  capabilities: InstitutionCapabilityReviewItem[];
  lms: {
    provider: string;
    selectionStatus: string;
    notes: string;
  };
  validation: string[];
}

const labelOverrides: Record<string, string> = {
  bible_school: "Bible school",
  childrens_school: "Children's school",
  studentPwa: "Student PWA",
  lmsLaunch: "LMS launch",
  lmsRosterSync: "LMS roster sync",
  lmsGradeReturn: "LMS grade return",
  shepherdAiRecommendations: "ShepherdAI recommendations",
  usesGpa: "GPA",
  moodle: "Moodle",
  canvas: "Canvas",
  youth_seminary: "Youth seminary",
  ministry_training_center: "Ministry training center",
  continuing_education: "Continuing education",
  homeschool_hybrid: "Homeschool hybrid",
  single_mode: "Single-mode",
  multi_mode: "Multi-mode",
};

function titleize(value: string) {
  const override = labelOverrides[value];
  if (override) return override;

  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function booleanLabel(value: boolean) {
  return value ? "Yes" : "No";
}

function capabilityItem(capabilities: InstitutionCapabilitySet, key: keyof InstitutionCapabilitySet): InstitutionCapabilityReviewItem {
  return {
    label: titleize(key),
    status: capabilities[key] ? "enabled" : "off",
  };
}

function buildOperatingRules(rules: InstitutionOperatingRules): InstitutionReviewItem[] {
  return [
    { label: "Academic year label", value: rules.academicYearLabel },
    { label: "Calendar", value: titleize(rules.defaultCalendarSystem) },
    { label: "Term structure", value: titleize(rules.defaultTermStructure) },
    { label: "Grade levels", value: booleanLabel(rules.usesGradeLevels) },
    { label: "Programs", value: booleanLabel(rules.usesPrograms) },
    { label: "Cohorts", value: booleanLabel(rules.usesCohorts) },
    { label: "Credits", value: booleanLabel(rules.usesCredits) },
    { label: "Clock hours", value: booleanLabel(rules.usesClockHours) },
    { label: "GPA", value: booleanLabel(rules.usesGpa) },
    { label: "Transcripts", value: booleanLabel(rules.usesTranscripts) },
    { label: "Guardians", value: booleanLabel(rules.usesGuardians) },
    { label: "Minors", value: booleanLabel(rules.allowsMinors) },
    { label: "Instructional role", value: titleize(rules.defaultInstructionalRoleLabel) },
    { label: "Official record", value: titleize(rules.officialRecordName) },
  ];
}

export function buildInstitutionReviewModel(profile: InstitutionProfile): InstitutionReviewModel {
  const supportedModes = normalizeSelectedInstitutionModes(profile.supportedModes);
  const institutionModel = resolveInstitutionModel(supportedModes);

  return {
    identity: {
      tenantId: profile.tenantId,
      institutionName: profile.institutionName,
      legalName: profile.legalName,
      institutionModel: titleize(institutionModel),
      primaryMode: titleize(profile.primaryMode),
      supportedModes: supportedModes.map(titleize),
      modePacks: supportedModes.map((mode) => getInstitutionModePack(mode).label),
      updatedAt: profile.updatedAt,
    },
    operatingRules: buildOperatingRules(profile.operatingRules),
    capabilities: [
      capabilityItem(profile.capabilities, "studentPwa"),
      capabilityItem(profile.capabilities, "guardianPortal"),
      capabilityItem(profile.capabilities, "facultyPortal"),
      capabilityItem(profile.capabilities, "registrarWorkflows"),
      capabilityItem(profile.capabilities, "admissionsWorkflows"),
      capabilityItem(profile.capabilities, "transcriptWorkflows"),
      capabilityItem(profile.capabilities, "graduationWorkflows"),
      capabilityItem(profile.capabilities, "lmsLaunch"),
      capabilityItem(profile.capabilities, "lmsRosterSync"),
      capabilityItem(profile.capabilities, "lmsGradeReturn"),
      capabilityItem(profile.capabilities, "shepherdAiRecommendations"),
    ],
    lms: {
      provider: titleize(profile.lmsPreference.provider),
      selectionStatus: titleize(profile.lmsPreference.selectionStatus),
      notes: profile.lmsPreference.notes ?? "No LMS notes recorded.",
    },
    validation: validateInstitutionProfile(profile),
  };
}
