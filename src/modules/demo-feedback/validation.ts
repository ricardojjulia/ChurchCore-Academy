import { DemoFeedbackSubmission, DemoFeedbackSubmissionInput, demoFeedbackCategories } from "@/modules/demo-feedback/types";
import { normalizeTextInput } from "@/modules/demo-feedback/normalize";

const categorySet = new Set<string>(demoFeedbackCategories);

function assertString(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }

  return value;
}

function assertArray(value: unknown, field: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }

  return value;
}

export function validateDemoFeedbackSubmission(input: DemoFeedbackSubmissionInput): DemoFeedbackSubmission {
  const sessionId = assertString(input.sessionId, "sessionId").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    throw new Error("sessionId must be a UUID.");
  }

  const route = assertString(input.route, "route").trim();
  if (route.length < 1 || route.length > 500) {
    throw new Error("route must be between 1 and 500 characters.");
  }

  const category = assertString(input.category, "category").trim();
  if (!categorySet.has(category)) {
    throw new Error("category is not allowed.");
  }

  const errorMessage = normalizeTextInput(input.errorMessage);
  if (errorMessage && errorMessage.length > 4000) {
    throw new Error("errorMessage must be at most 4000 characters.");
  }

  const note = normalizeTextInput(input.note);
  if (note && note.length > 2000) {
    throw new Error("note must be at most 2000 characters.");
  }

  const breadcrumbs = assertArray(input.breadcrumbs, "breadcrumbs");
  if (breadcrumbs.length > 5) {
    throw new Error("breadcrumbs must contain at most 5 entries.");
  }

  const normalizedBreadcrumbs = breadcrumbs.map((breadcrumb, index) => {
    const value = assertString(breadcrumb, `breadcrumbs[${index}]`).trim();
    if (value.length > 500) {
      throw new Error("each breadcrumb must be at most 500 characters.");
    }
    return value;
  });

  const demoVersion = assertString(input.demoVersion, "demoVersion").trim();
  if (demoVersion.length < 1 || demoVersion.length > 100) {
    throw new Error("demoVersion must be between 1 and 100 characters.");
  }

  if (!Number.isInteger(input.sessionDurationSeconds)) {
    throw new Error("sessionDurationSeconds must be an integer.");
  }

  if (input.sessionDurationSeconds < 0 || input.sessionDurationSeconds > 2592000) {
    throw new Error("sessionDurationSeconds must be between 0 and 2592000.");
  }

  return {
    sessionId,
    route,
    category: category as DemoFeedbackSubmission["category"],
    errorMessage,
    note,
    breadcrumbs: normalizedBreadcrumbs,
    demoVersion,
    sessionDurationSeconds: input.sessionDurationSeconds,
  };
}

export function parseDemoFeedbackJsonBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object.");
  }

  const body = value as Record<string, unknown>;

  return validateDemoFeedbackSubmission({
    sessionId: body.sessionId as string,
    route: body.route as string,
    category: body.category as DemoFeedbackSubmission["category"],
    errorMessage: body.errorMessage as string | undefined,
    note: body.note as string | undefined,
    breadcrumbs: body.breadcrumbs as string[],
    demoVersion: body.demoVersion as string,
    sessionDurationSeconds: body.sessionDurationSeconds as number,
  });
}
