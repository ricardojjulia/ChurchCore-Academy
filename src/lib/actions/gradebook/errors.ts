import { ZodError } from "zod";
import { AcademyConflictError } from "@/modules/academy-auth/errors";

export function toGradebookActionError(error: unknown) {
  if (error instanceof ZodError) {
    return "Invalid gradebook input.";
  }

  if (error instanceof Error && error.message.startsWith("Forbidden")) {
    return "You do not have permission to perform this gradebook action.";
  }

  // AcademyConflictError messages are deliberately written to be safe and useful to show the
  // caller (e.g. "this grade is already posted... use the override workflow") — surface them
  // directly instead of collapsing to the generic message below, matching how the REST
  // equivalent of this write path (GradebookPostgresRepository.gradeSubmission, via handleApi)
  // maps the same error class to a specific HTTP 409 rather than a generic 500.
  if (error instanceof AcademyConflictError) {
    return error.message;
  }

  return "Gradebook write failed.";
}
