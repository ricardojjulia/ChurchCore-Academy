import { AiSignalRecord, ShepherdAiSuggestion, SignalCategory } from "@/modules/shepherd-ai/types";
import { AcademyContext } from "@/modules/shepherd-ai/context-builder";
import { ScoredConcern } from "@/modules/shepherd-ai/academic-concern-scorer";

const categoryBySignalType: Record<AiSignalRecord["signalType"], SignalCategory[]> = {
  enrollment_pending_beyond_threshold: ["enrollment-signals", "student-record-signals"],
  required_document_missing: ["student-record-signals", "enrollment-signals"],
  graduation_threshold_near: ["graduation-signals", "student-record-signals"],
  credit_progress_gap: ["student-record-signals", "graduation-signals"],
  transcript_inconsistency_possible: ["transcript-signals", "student-record-signals"],
  course_without_instructor: ["faculty-admin-signals"],
  faculty_course_assignment_imbalance: ["faculty-admin-signals"],
  calendar_setup_incomplete_or_inconsistent: ["institutional-setup-signals"],
  attendance_threshold_exceeded: ["student-record-signals", "enrollment-signals"],
};

function normalizeValidationError(value: string) {
  const trimmed = value.trim().replace(/[.\s]+$/u, "");
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return `${normalized}.`;
}

function extractCalendarValidationDetails(signal: AiSignalRecord) {
  if (signal.signalType !== "calendar_setup_incomplete_or_inconsistent") {
    return [];
  }

  const { validationErrors } = signal.signalPayloadJson;
  if (!Array.isArray(validationErrors)) {
    return [];
  }

  return validationErrors
    .filter((value): value is string => typeof value === "string")
    .map(normalizeValidationError)
    .filter((value): value is string => Boolean(value))
    .map((value) => `Calendar validation detail: ${value}`);
}

export class SuggestionExplainer {
  build(
    signal: AiSignalRecord,
    context: AcademyContext,
    score: ScoredConcern,
    title: string,
    whyItSurfaced: string,
  ): ShepherdAiSuggestion["explanation"] {
    const validationDetails = extractCalendarValidationDetails(signal);
    const whySurfaced = [
      whyItSurfaced,
      `Confidence is ${score.confidenceScore}% because the recommendation is based on structured Academy records and deterministic threshold checks.`,
      `Urgency is ${score.urgency} because the current signal set suggests academic-administrative review may be warranted.`,
    ];

    if (validationDetails.length > 0) {
      whySurfaced.unshift(
        `Calendar validation found specific gaps that need review: ${validationDetails
          .map((detail) => detail.replace(/^Calendar validation detail: /u, "").replace(/[.]$/u, ""))
          .join("; ")}.`,
      );
    }

    return {
      detected: [`${title} surfaced for ${context.entityLabel}.`, ...validationDetails],
      whySurfaced,
      sourceSignalCategories: categoryBySignalType[signal.signalType],
      limitations: [
        "This recommendation uses Academy SIS and education-management records only.",
        "It does not use LMS, Care, Ops, ministry, counseling, devotional, attendance, giving, or spiritual-formation data.",
        "It is a recommendation for human review, not an official institutional decision.",
      ],
    };
  }
}
