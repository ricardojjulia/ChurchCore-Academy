import { ShepherdAiSuggestion, Urgency } from "@/modules/shepherd-ai/types";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";

const GPA_WARNING_THRESHOLD = 2.0;
const GPA_HIGH_URGENCY_THRESHOLD = 1.5;

interface ExistingSuggestion {
  id: string;
  status: ShepherdAiSuggestion["status"];
}

export async function evaluateStudentGpaSignal(
  tenantId: string,
  studentPersonId: string,
  currentGpa: number | null,
  previousGpa: number | null,
  sectionName: string,
  onAcademicProbation: boolean,
  supportsGpa: boolean,
  repository: ShepherdAiPostgresRepository,
  studentName?: string,
): Promise<void> {
  if (!supportsGpa || currentGpa === null) {
    return;
  }

  if (currentGpa >= GPA_WARNING_THRESHOLD) {
    const existing = await findExistingSuggestion(
      tenantId,
      studentPersonId,
      repository,
    );
    if (existing && (existing.status === "suggested" || existing.status === "promoted_to_workflow")) {
      await repository.updateSuggestionStatus(tenantId, existing.id, "resolved");
    }
    return;
  }

  const urgency: Urgency =
    currentGpa < GPA_HIGH_URGENCY_THRESHOLD ? "high" : "medium";
  const confidenceScore = urgency === "high" ? 0.95 : 0.8;

  const displayName = studentName ?? "Student";
  const gpaChangeText = previousGpa !== null
    ? `dropped from ${previousGpa.toFixed(2)} to ${currentGpa.toFixed(2)}`
    : "recorded for first graded course";

  let summary = `${displayName}'s cumulative GPA ${gpaChangeText} after posting in ${sectionName}. Current GPA is below the ${GPA_WARNING_THRESHOLD.toFixed(1)} warning threshold.`;

  if (onAcademicProbation) {
    summary += " Note: student is currently on approved academic probation.";
  }

  const existing = await findExistingSuggestion(
    tenantId,
    studentPersonId,
    repository,
  );

  const suggestion: ShepherdAiSuggestion = {
    id: existing?.id ?? `gpa-drop-${tenantId}-${studentPersonId}-${Date.now()}`,
    tenantId,
    productArea: "academy",
    workflowType: "academic",
    workflowCode: "academic_standing_or_credit_progress_review",
    entityType: "student",
    entityId: studentPersonId,
    title: "Possible Finding: GPA below warning threshold",
    summary,
    confidenceScore,
    urgency,
    suggestedActions: [
      {
        actionType: "assign",
        label: "Assign advisor review",
        description: "Assign this student to an advisor for academic standing review",
        requiresHumanReview: true,
      },
      {
        actionType: "outreach",
        label: "Draft support-oriented outreach",
        description: "Prepare compassionate communication to student",
        requiresHumanReview: true,
      },
    ],
    explanation: {
      detected: [`GPA ${currentGpa.toFixed(2)} is below ${GPA_WARNING_THRESHOLD.toFixed(1)} threshold`],
      whySurfaced: ["Academic progress indicators suggest review may be appropriate"],
      sourceSignalCategories: ["student-record-signals"],
      limitations: [
        "Does not infer motivation, ability, spiritual condition, or personal challenges",
      ],
    },
    boundaryNote:
      "This suggestion does not infer motivation, ability, spiritual condition, personal challenges, or learning engagement.",
    generatedAt: new Date().toISOString(),
    status:
      existing && (existing.status === "dismissed" || existing.status === "resolved")
        ? "suggested"
        : existing?.status ?? "suggested",
  };

  if (!existing || existing.status === "dismissed" || existing.status === "resolved") {
    await repository.saveSuggestions([suggestion]);
  } else {
    await repository.saveSuggestions([suggestion]);
  }
}

async function findExistingSuggestion(
  tenantId: string,
  studentPersonId: string,
  repository: ShepherdAiPostgresRepository,
): Promise<ExistingSuggestion | null> {
  const suggestions = await repository.fetchSuggestions(tenantId);
  const match = suggestions.find(
    (s) =>
      s.entityId === studentPersonId &&
      s.workflowCode === "academic_standing_or_credit_progress_review" &&
      s.status !== "dismissed" &&
      s.status !== "resolved",
  );
  return match ? { id: match.id, status: match.status } : null;
}
