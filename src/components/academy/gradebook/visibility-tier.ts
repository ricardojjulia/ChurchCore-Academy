import type { VisibilityTier } from "@/lib/ui/theme";

export function isInstructorOnlyVisibility(tier: VisibilityTier) {
  return tier === "instructor_only";
}

export function canLearnerViewVisibility(tier: VisibilityTier) {
  return tier === "learner_safe";
}

export function visibilityTierLabel(tier: VisibilityTier) {
  if (tier === "instructor_only") return "Instructor only";
  if (tier === "staff_only") return "Staff only";
  return "Learner safe";
}
