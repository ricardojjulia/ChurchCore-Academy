import { AiSignalRecord, Urgency } from "@/modules/shepherd-ai/types";

export interface ScoredConcern {
  confidenceScore: number;
  urgency: Urgency;
}

export class AcademicConcernScorer {
  score(signalOrSignals: AiSignalRecord | AiSignalRecord[]): ScoredConcern {
    const signals = Array.isArray(signalOrSignals) ? signalOrSignals : [signalOrSignals];
    let score = 0;

    for (const signal of signals) {
      switch (signal.signalType) {
        case "enrollment_pending_beyond_threshold":
          score += 30;
          break;
        case "required_document_missing":
          score += 25;
          break;
        case "graduation_threshold_near":
          score += 35;
          break;
        case "credit_progress_gap":
          score += 30;
          break;
        case "transcript_inconsistency_possible":
          score += 40;
          break;
        case "course_without_instructor":
          score += 45;
          break;
        case "faculty_course_assignment_imbalance":
          score += 35;
          break;
        default:
          score += 10;
      }
    }

    const confidenceScore = Math.min(score, 100);
    let urgency: Urgency = "low";

    if (confidenceScore >= 80) urgency = "critical";
    else if (confidenceScore >= 60) urgency = "high";
    else if (confidenceScore >= 35) urgency = "medium";

    return { confidenceScore, urgency };
  }
}
