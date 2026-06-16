import type { GradebookVisibilityTier } from "@/types/gradebook";

export const gradebookColumns = [
  "learner",
  "assignment",
  "status",
  "submittedAt",
  "grade",
  "sensitivity",
  "behavioralSignal",
] as const;

export type GradebookColumn = (typeof gradebookColumns)[number];

const visibilityByTier: Record<GradebookVisibilityTier, ReadonlySet<GradebookColumn>> = {
  student: new Set(["assignment", "status", "grade", "sensitivity"]),
  instructor: new Set([
    "learner",
    "assignment",
    "status",
    "submittedAt",
    "grade",
    "sensitivity",
    "behavioralSignal",
  ]),
  admin: new Set([
    "learner",
    "assignment",
    "status",
    "submittedAt",
    "grade",
    "sensitivity",
    "behavioralSignal",
  ]),
};

export function getVisibleGradebookColumns(tier: GradebookVisibilityTier) {
  return gradebookColumns.filter((column) => visibilityByTier[tier].has(column));
}
