import { AcademyContext } from "@/modules/shepherd-ai/context-builder";
import { WorkflowCode } from "@/modules/shepherd-ai/types";

export class MessageDraftGenerator {
  draft(workflowCode: WorkflowCode, context: AcademyContext): string | undefined {
    switch (workflowCode) {
      case "incomplete_enrollment_follow_up":
        return `Hello,\n\nChurchCore Academy is reviewing the enrollment record for ${context.entityLabel}. A few administrative steps may still need attention. Please review the remaining enrollment items and let us know if you need help completing them.\n\nThank you,\n${context.ownerRole}`;
      case "missing_documentation_review":
        return `Hello,\n\nChurchCore Academy is reviewing ${context.entityLabel}'s student record. One or more required documents appear to be missing or still pending verification. Please review the record and submit the remaining items so the file can be completed.\n\nThank you,\n${context.ownerRole}`;
      case "academic_standing_or_credit_progress_review":
        return `Hello,\n\nChurchCore Academy would like to schedule an academic planning review for ${context.entityLabel}. Recent record signals suggest a program progress check may be helpful. Please review the degree plan and consider next-step advising support.\n\nThank you,\n${context.ownerRole}`;
      default:
        return undefined;
    }
  }
}
