import { AiSignalRecord, ShepherdAiSuggestion, WorkflowCode } from "@/modules/shepherd-ai/types";
import { AcademyContext } from "@/modules/shepherd-ai/context-builder";
import { ScoredConcern } from "@/modules/shepherd-ai/academic-concern-scorer";
import { SuggestionExplainer } from "@/modules/shepherd-ai/suggestion-explainer";
import { MessageDraftGenerator } from "@/modules/shepherd-ai/message-draft-generator";

interface RecommendationBlueprint {
  workflowCode: WorkflowCode;
  title: string;
  summary: string;
  suggestedActions: string[];
  boundaryNote: string;
  whyItSurfaced: string;
}

function recommendationForSignal(signal: AiSignalRecord, context: AcademyContext): RecommendationBlueprint {
  switch (signal.signalType) {
    case "incomplete_enrollment":
      return {
        workflowCode: "incomplete-enrollment-follow-up",
        title: "Suggested Academic Workflow: incomplete enrollment follow-up",
        summary: `${context.entityLabel} may require admissions follow-up because enrollment steps appear incomplete or unresolved beyond the configured review window.`,
        suggestedActions: [
          "Assign admissions/admin follow-up",
          "Identify missing enrollment steps",
          "Create reminder task",
          "Draft enrollment completion message",
        ],
        boundaryNote: "Do not assume lack of interest or personal, financial, or spiritual reasons.",
        whyItSurfaced: "The enrollment record shows unresolved steps, missing assignment details, or a pending status beyond the configured threshold.",
      };
    case "missing_student_documentation":
      return {
        workflowCode: "missing-student-documentation-review",
        title: "Suggested Academic Workflow: missing student documentation review",
        summary: `${context.entityLabel} may require registrar or administrative review because required student documentation appears incomplete.`,
        suggestedActions: [
          "Notify registrar or administrator",
          "Draft document request message",
          "Create student record follow-up task",
          "Mark record as pending documentation",
        ],
        boundaryNote: "Frame this as administrative completion, not student fault.",
        whyItSurfaced: "Required documentation fields are missing or pending verification in the Academy record.",
      };
    case "graduation_eligibility":
      return {
        workflowCode: "graduation-eligibility-review",
        title: "Suggested Academic Workflow: graduation eligibility review",
        summary: `${context.entityLabel} may be ready for registrar review because program completion indicators are approaching graduation thresholds.`,
        suggestedActions: [
          "Assign registrar review",
          "Verify completed credits",
          "Verify program requirements",
          "Prepare graduation eligibility checklist",
        ],
        boundaryNote: "Do not declare final graduation eligibility without authorized administrative approval.",
        whyItSurfaced: "Credits earned and program completion indicators suggest graduation readiness may warrant review.",
      };
    case "academic_progress_gap":
      return {
        workflowCode: "academic-progress-review",
        title: "Suggested Academic Workflow: academic standing or credit progress review",
        summary: `${context.entityLabel} may benefit from advisor review because academic progress appears below the expected milestone or registration continuity is unresolved.`,
        suggestedActions: [
          "Assign advisor review",
          "Draft support-oriented outreach",
          "Recommend academic planning meeting",
          "Review program completion plan",
        ],
        boundaryNote: "Do not infer motivation, ability, or spiritual condition.",
        whyItSurfaced: "Program progress, GPA, or expected next-term registration signals suggest a review of academic pacing may be appropriate.",
      };
    case "transcript_records_inconsistency":
      return {
        workflowCode: "transcript-records-inconsistency-review",
        title: "Suggested Academic Workflow: transcript or records inconsistency review",
        summary: `${context.entityLabel} may require registrar verification because transcript data and academic records appear inconsistent.`,
        suggestedActions: [
          "Assign registrar review",
          "Flag record for correction",
          "Request verification",
          "Create audit note",
        ],
        boundaryNote: "Present this as a possible data inconsistency, not a confirmed error unless validated.",
        whyItSurfaced: "Transcript credit totals, duplicated records, or conflicting status indicators suggest a records audit may be needed.",
      };
    case "faculty_course_assignment_imbalance":
      return {
        workflowCode: "faculty-course-assignment-imbalance-review",
        title: "Suggested Academic Workflow: faculty or course assignment imbalance review",
        summary: `${context.entityLabel} may require academic administration review because faculty load, roster capacity, or section setup appears out of balance.`,
        suggestedActions: [
          "Notify academic administrator",
          "Suggest reassignment review",
          "Create course setup task",
          "Flag staffing imbalance",
        ],
        boundaryNote: "Present this as administrative review, not performance criticism.",
        whyItSurfaced: "Faculty assignment counts, advisee ratios, roster capacity, or section setup indicators exceeded configured administrative thresholds.",
      };
  }
}

export class WorkflowRecommender {
  constructor(
    private readonly explainer = new SuggestionExplainer(),
    private readonly messageDraftGenerator = new MessageDraftGenerator(),
  ) {}

  recommend(signal: AiSignalRecord, context: AcademyContext, score: ScoredConcern): ShepherdAiSuggestion {
    const blueprint = recommendationForSignal(signal, context);
    const messageDraft = this.messageDraftGenerator.draft(blueprint.workflowCode, context);

    return {
      id: `suggestion-${signal.id}`,
      tenantId: signal.tenantId,
      productArea: "academy",
      workflowType: "academic",
      workflowCode: blueprint.workflowCode,
      entityType: signal.entityType,
      entityId: signal.entityId,
      title: blueprint.title,
      summary: blueprint.summary,
      confidenceScore: score.confidenceScore,
      urgency: score.urgency,
      suggestedActions: blueprint.suggestedActions,
      explanation: this.explainer.build(signal, context, score, blueprint.title, blueprint.whyItSurfaced),
      boundaryNote: blueprint.boundaryNote,
      generatedAt: signal.detectedAt,
      status: "suggested",
      messageDraft,
    };
  }
}
