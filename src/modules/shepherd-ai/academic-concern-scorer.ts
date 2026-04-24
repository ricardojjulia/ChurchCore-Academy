import { AiSignalRecord, Urgency } from "@/modules/shepherd-ai/types";

export interface ScoredConcern {
  confidenceScore: number;
  urgency: Urgency;
}

function clamp(score: number) {
  return Math.max(1, Math.min(99, Math.round(score)));
}

export class AcademicConcernScorer {
  score(signal: AiSignalRecord): ScoredConcern {
    switch (signal.signalType) {
      case "incomplete_enrollment":
        return {
          confidenceScore: clamp(58 + signal.signalValue * 4),
          urgency: signal.signalValue >= 15 ? "high" : "medium",
        };
      case "missing_student_documentation":
        return {
          confidenceScore: clamp(62 + signal.signalValue * 6),
          urgency: signal.signalValue >= 3 ? "high" : "medium",
        };
      case "graduation_eligibility":
        return {
          confidenceScore: clamp(74 + signal.signalValue * 0.15),
          urgency: signal.signalValue >= 98 ? "high" : "medium",
        };
      case "academic_progress_gap":
        return {
          confidenceScore: clamp(60 + signal.signalValue * 3),
          urgency: signal.signalValue >= 12 ? "high" : "medium",
        };
      case "transcript_records_inconsistency":
        return {
          confidenceScore: clamp(68 + signal.signalValue * 2),
          urgency: signal.signalValue >= 6 ? "high" : "medium",
        };
      case "faculty_course_assignment_imbalance":
        return {
          confidenceScore: clamp(63 + signal.signalValue * 2),
          urgency: signal.signalValue >= 8 ? "high" : "medium",
        };
      default:
        return { confidenceScore: 50, urgency: "low" };
    }
  }
}
