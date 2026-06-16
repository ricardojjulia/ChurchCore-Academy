import type { GradeDisplayInput, GradeDisplayOutput } from "@/types/gradebook";

const restrictedPhrases: Array<[RegExp, string]> = [
  [/failed?/gi, "needs support"],
  [/failing/gi, "needs support"],
  [/ministry failure/gi, "ministry growth area"],
  [/not called/gi, "discernment area"],
  [/unfit/gi, "needs a faculty conversation"],
  [/deficient/gi, "developing"],
];

function clampPercentage(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}

function formatPercentage(value: number | null) {
  const percentage = clampPercentage(value);

  if (percentage === null) {
    return "Grade pending";
  }

  return `${Math.round(percentage)}% complete`;
}

function sanitizeFeedback(value: string | null, sensitivityTier: GradeDisplayInput["sensitivityTier"]) {
  if (!value) {
    return null;
  }

  if (sensitivityTier !== "pastoral") {
    return value;
  }

  return restrictedPhrases.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );
}

function getPrimaryLabel(input: GradeDisplayInput) {
  if (input.sensitivityTier === "pastoral") {
    return "Pastoral formation review";
  }

  if (input.percentage === null) {
    return "Awaiting grade";
  }

  if (input.isPassing === false) {
    return "Needs support";
  }

  if (input.isPassing === true) {
    return "On track";
  }

  return input.letterGrade ? `Current standing: ${input.letterGrade}` : "Grade posted";
}

function getContextStatement(input: GradeDisplayInput) {
  if (input.sensitivityTier === "pastoral") {
    return "This grade is framed as a growth conversation and does not determine calling, worth, or ministry fit.";
  }

  if (input.isPassing === false) {
    return "Review the feedback and next steps with your instructor.";
  }

  return "Use the feedback to guide your next learning step.";
}

export function growthFrameFilter(input: GradeDisplayInput): GradeDisplayOutput {
  return {
    assignmentTitle: input.assignmentTitle,
    displayPercentage: formatPercentage(input.percentage),
    primaryLabel: getPrimaryLabel(input),
    contextStatement: getContextStatement(input),
    feedbackDisplay: sanitizeFeedback(input.instructorFeedback, input.sensitivityTier),
    showRawScore: false,
  };
}
