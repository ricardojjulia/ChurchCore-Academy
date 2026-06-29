import {
  aggregateModePackCapabilities,
  aggregateModePackOperatingRules,
  normalizeSelectedInstitutionModes,
  resolveConcretePrimaryMode,
} from "@/modules/academy-config/mode-packs";
import { InstitutionMode, InstitutionProfile, LmsProvider } from "@/modules/academy-config/types";

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

export function createInstitutionProfileDefaults(input: CreateInstitutionProfileInput): InstitutionProfile {
  const selectedModes = input.supportedModes?.length ? input.supportedModes : [input.primaryMode];
  const supportedModes = normalizeSelectedInstitutionModes(selectedModes);
  const concretePrimaryMode = resolveConcretePrimaryMode(input.primaryMode, supportedModes);
  const operatingRules = aggregateModePackOperatingRules(supportedModes);
  const modeCapabilities = aggregateModePackCapabilities(supportedModes);
  const lmsProvider = input.lmsProvider ?? "none";
  const hasLmsProvider = lmsProvider === "moodle" || lmsProvider === "canvas";
  const isPostsecondary = supportedModes.some((mode) => postsecondaryModes.has(mode)) || postsecondaryModes.has(concretePrimaryMode);
  const timestamp = input.now ?? nowDefault;

  return {
    tenantId: input.tenantId,
    institutionName: input.institutionName,
    legalName: input.legalName,
    primaryMode: concretePrimaryMode,
    supportedModes,
    operatingRules,
    capabilities: {
      ...modeCapabilities,
      guardianPortal: modeCapabilities.guardianPortal || operatingRules.usesGuardians,
      transcriptWorkflows: modeCapabilities.transcriptWorkflows || (isPostsecondary && operatingRules.usesTranscripts),
      graduationWorkflows: modeCapabilities.graduationWorkflows || isPostsecondary,
      lmsLaunch: hasLmsProvider,
      lmsRosterSync: hasLmsProvider,
      lmsGradeReturn: hasLmsProvider,
    },
    lmsPreference: {
      provider: lmsProvider,
      selectionStatus: hasLmsProvider ? "planned" : lmsProvider === "none" ? "not_needed" : "planned",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
