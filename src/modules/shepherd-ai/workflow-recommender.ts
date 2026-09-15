import { AiSignalRecord, ShepherdAiSuggestedAction, ShepherdAiSuggestion, WorkflowCode } from "@/modules/shepherd-ai/types";
import { AcademyContext } from "@/modules/shepherd-ai/context-builder";
import { ScoredConcern } from "@/modules/shepherd-ai/academic-concern-scorer";
import { SuggestionExplainer } from "@/modules/shepherd-ai/suggestion-explainer";
import { MessageDraftGenerator } from "@/modules/shepherd-ai/message-draft-generator";

interface RecommendationBlueprint {
  workflowCode: WorkflowCode;
  title: string;
  summary: string;
  suggestedActions: ShepherdAiSuggestedAction[];
  boundaryNote: string;
  whyItSurfaced: string;
}

function actions(labels: string[]): ShepherdAiSuggestedAction[] {
  return labels.map((label) => ({
    actionType: label.toLowerCase().replaceAll("/", " ").replaceAll(" ", "_"),
    label,
    description: label,
    requiresHumanReview: true,
  }));
}

function recommendationForSignal(signal: AiSignalRecord, context: AcademyContext): RecommendationBlueprint {
  switch (signal.signalType) {
    case "enrollment_pending_beyond_threshold":
      return {
        workflowCode: "incomplete_enrollment_follow_up",
        title: "Possible Finding: incomplete enrollment follow-up",
        summary: `${context.entityLabel} may require admissions follow-up because enrollment steps appear incomplete or unresolved beyond the configured review window.`,
        suggestedActions: actions([
          "Assign admissions/admin follow-up",
          "Identify missing enrollment steps",
          "Create reminder task",
          "Draft enrollment completion message",
        ]),
        boundaryNote:
          "This suggestion is based only on Academy enrollment records. It does not assume lack of interest, financial reasons, personal reasons, spiritual condition, or learning engagement.",
        whyItSurfaced: "The enrollment record shows unresolved steps, missing assignment details, or a pending status beyond the configured threshold.",
      };
    case "required_document_missing":
      return {
        workflowCode: "missing_documentation_review",
        title: "Possible Finding: missing student documentation review",
        summary: `${context.entityLabel} may require registrar or administrative review because required student documentation appears incomplete.`,
        suggestedActions: actions([
          "Notify registrar or administrator",
          "Draft document request message",
          "Create student record follow-up task",
          "Mark record as pending documentation",
        ]),
        boundaryNote:
          "This suggestion is an administrative record-completion review. It should not be framed as student fault or lack of commitment.",
        whyItSurfaced: "Required documentation fields are missing or pending verification in the Academy record.",
      };
    case "graduation_threshold_near":
      return {
        workflowCode: "graduation_eligibility_review",
        title: "Possible Finding: graduation eligibility review",
        summary: `${context.entityLabel} may be ready for registrar review because program completion indicators are approaching graduation thresholds.`,
        suggestedActions: actions([
          "Assign registrar review",
          "Verify completed credits",
          "Verify program requirements",
          "Prepare graduation eligibility checklist",
        ]),
        boundaryNote:
          "This suggestion does not declare final graduation eligibility. Final approval requires authorized registrar or institutional review.",
        whyItSurfaced: "Credits earned and program completion indicators suggest graduation readiness may warrant review.",
      };
    case "credit_progress_gap":
      return {
        workflowCode: "academic_standing_or_credit_progress_review",
        title: "Possible Finding: academic standing or credit progress review",
        summary: `${context.entityLabel} may benefit from advisor review because academic progress appears below the expected milestone or registration continuity is unresolved.`,
        suggestedActions: actions([
          "Assign advisor review",
          "Draft support-oriented outreach",
          "Recommend academic planning meeting",
          "Review program completion plan",
        ]),
        boundaryNote:
          "This suggestion does not infer motivation, ability, spiritual condition, personal challenges, or learning engagement.",
        whyItSurfaced: "Program progress, GPA, or expected next-term registration signals suggest a review of academic pacing may be appropriate.",
      };
    case "transcript_inconsistency_possible":
      return {
        workflowCode: "transcript_or_records_inconsistency_review",
        title: "Possible Finding: transcript or records inconsistency review",
        summary: `${context.entityLabel} may require registrar verification because transcript data and academic records appear inconsistent.`,
        suggestedActions: actions([
          "Assign registrar review",
          "Flag record for correction",
          "Request verification",
          "Create audit note",
        ]),
        boundaryNote:
          "This suggestion identifies a possible records inconsistency requiring verification. It should not be treated as a confirmed error until reviewed.",
        whyItSurfaced: "Transcript credit totals, duplicated records, or conflicting status indicators suggest a records audit may be needed.",
      };
    case "course_without_instructor":
    case "faculty_course_assignment_imbalance":
      return {
        workflowCode: "faculty_or_course_assignment_imbalance_review",
        title: "Possible Finding: faculty or course assignment imbalance review",
        summary: `${context.entityLabel} may require academic administration review because faculty load, roster capacity, or section setup appears out of balance.`,
        suggestedActions: actions([
          "Notify academic administrator",
          "Suggest reassignment review",
          "Create course setup task",
          "Flag staffing imbalance",
        ]),
        boundaryNote:
          "This suggestion is for administrative planning and should not be framed as faculty performance criticism.",
        whyItSurfaced: "Faculty assignment counts, advisee ratios, roster capacity, or section setup indicators exceeded configured administrative thresholds.",
      };
    case "calendar_setup_incomplete_or_inconsistent":
      return {
        workflowCode: "calendar_setup_review",
        title: "Possible Finding: calendar setup review",
        summary: `${context.entityLabel} calendar and academic configuration may require administrative review because one or more validation checks indicate incomplete or inconsistent setup.`,
        suggestedActions: actions([
          "Review calendar validation report",
          "Verify academic year and period dates",
          "Confirm enrollment window configuration",
          "Validate grading windows and transcript periods",
        ]),
        boundaryNote:
          "This suggestion is for administrative setup completion. It does not impact currently active academic operations unless the issues directly affect current periods.",
        whyItSurfaced: "Academic calendar validation detected configuration errors that should be resolved before relying on the calendar for enrollment, grading, and institutional decisions.",
      };
    case "attendance_threshold_exceeded":
      return {
        workflowCode: "academic_standing_or_credit_progress_review",
        title: "Possible Finding: attendance threshold exceeded",
        summary: `${context.entityLabel} may require advisor or registrar review because absence rate has crossed a configured threshold.`,
        suggestedActions: actions([
          "Review attendance record",
          "Contact student or guardian",
          "Assign advisor follow-up",
          "Document attendance concern",
        ]),
        boundaryNote:
          "This suggestion is based on Academy attendance records only. It does not infer reasons for absence, student motivation, personal circumstances, or spiritual condition.",
        whyItSurfaced: "Absence rate for one or more course sections exceeded the configured warning or alert threshold.",
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
