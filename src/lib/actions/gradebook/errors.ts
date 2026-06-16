import { ZodError } from "zod";

export function toGradebookActionError(error: unknown) {
  if (error instanceof ZodError) {
    return "Invalid gradebook input.";
  }

  if (error instanceof Error && error.message.startsWith("Forbidden")) {
    return "You do not have permission to perform this gradebook action.";
  }

  return "Gradebook write failed.";
}
