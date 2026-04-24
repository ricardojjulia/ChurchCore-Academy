import { AiSignalRecord, ShepherdAiSuggestion, SignalCategory } from "@/modules/shepherd-ai/types";
import { AcademyContext } from "@/modules/shepherd-ai/context-builder";
import { ScoredConcern } from "@/modules/shepherd-ai/academic-concern-scorer";

const categoryBySignalType: Record<AiSignalRecord["signalType"], SignalCategory[]> = {
  incomplete_enrollment: ["enrollment-signals", "student-record-signals"],
  missing_student_documentation: ["student-record-signals", "enrollment-signals"],
  graduation_eligibility: ["graduation-signals", "student-record-signals"],
  academic_progress_gap: ["student-record-signals", "graduation-signals"],
  transcript_records_inconsistency: ["transcript-signals", "student-record-signals"],
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
      whatDetected: `${title} surfaced for ${context.entityLabel}.`,
      whyItSurfaced,
      confidenceRationale: `Confidence is ${score.confidenceScore}% because the recommendation is based on structured Academy records and deterministic threshold checks.`,
      urgencyRationale: `Urgency is ${score.urgency} because the current signal set suggests time-sensitive academic-administrative review may be warranted.`,
      sourceSignalCategories: categoryBySignalType[signal.signalType],
    };
  }
}
