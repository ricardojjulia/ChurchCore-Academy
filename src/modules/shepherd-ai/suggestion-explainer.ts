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
};

export class SuggestionExplainer {
  build(
    signal: AiSignalRecord,
    context: AcademyContext,
    score: ScoredConcern,
    title: string,
    whyItSurfaced: string,
  ): ShepherdAiSuggestion["explanation"] {
    return {
      detected: [`${title} surfaced for ${context.entityLabel}.`],
      whySurfaced: [
        whyItSurfaced,
        `Confidence is ${score.confidenceScore}% because the recommendation is based on structured Academy records and deterministic threshold checks.`,
        `Urgency is ${score.urgency} because the current signal set suggests academic-administrative review may be warranted.`,
      ],
      sourceSignalCategories: categoryBySignalType[signal.signalType],
      limitations: [
        "This recommendation uses Academy SIS and college-management records only.",
        "It does not use LMS, Care, Ops, ministry, counseling, devotional, attendance, giving, or spiritual-formation data.",
        "It is a recommendation for human review, not an official institutional decision.",
      ],
    };
  }
}
