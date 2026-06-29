import { isConcreteInstitutionMode } from "@/modules/academy-config/mode-packs";
import { InstitutionMode, InstitutionProfile, LmsProvider } from "@/modules/academy-config/types";

const postsecondaryTranscriptModes = new Set<InstitutionMode>(["seminary", "college", "university"]);

function hasLmsProvider(provider: LmsProvider) {
  return provider === "moodle" || provider === "canvas";
}

function hasPostsecondaryTranscriptMode(profile: InstitutionProfile) {
  return profile.supportedModes.some((mode) => postsecondaryTranscriptModes.has(mode));
}

export function validateInstitutionProfile(profile: InstitutionProfile): string[] {
  const errors: string[] = [];

  if (profile.supportedModes.length === 0) {
    errors.push("Institution profile must include at least one supported institution mode.");
  }

  if (profile.supportedModes.includes("mixed")) {
    errors.push("Supported institution modes must be concrete modes; mixed is derived from multiple selected modes.");
  }

  for (const mode of profile.supportedModes) {
    if (mode !== "mixed" && !isConcreteInstitutionMode(mode)) {
      errors.push(`Unsupported institution mode: ${mode}.`);
    }
  }

  if (!profile.supportedModes.includes(profile.primaryMode)) {
    errors.push("Primary institution mode must be included in supported modes.");
  }

  if (profile.primaryMode === "mixed") {
    errors.push("Primary institution mode must be concrete; mixed is derived from multiple selected modes.");
  }

  if (profile.operatingRules.allowsMinors && !profile.operatingRules.usesGuardians) {
    errors.push("Institutions that allow minors must enable guardian support.");
  }

  if (profile.capabilities.guardianPortal && !profile.operatingRules.usesGuardians) {
    errors.push("Guardian portal requires guardian support in operating rules.");
  }

  if (profile.capabilities.lmsRosterSync && !hasLmsProvider(profile.lmsPreference.provider)) {
    errors.push("LMS roster sync requires Moodle or Canvas as the LMS provider.");
  }

  if (profile.capabilities.lmsGradeReturn && !hasLmsProvider(profile.lmsPreference.provider)) {
    errors.push("LMS grade return requires Moodle or Canvas as the LMS provider.");
  }

  if (
    hasPostsecondaryTranscriptMode(profile) &&
    profile.operatingRules.usesTranscripts &&
    !profile.operatingRules.usesCredits &&
    !profile.operatingRules.usesClockHours
  ) {
    errors.push("Transcript-bearing postsecondary institutions must use credits or clock hours.");
  }

  return errors;
}
