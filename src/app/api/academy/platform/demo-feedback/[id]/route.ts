import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { assertPlatformStaffWorkspaceAccess } from "@/modules/academy-auth/policy";
import { resolvePlatformRoles } from "@/modules/academy-auth/platform-request-context";
import { demoFeedbackActions, DemoFeedbackTriageUpdate } from "@/modules/demo-feedback/types";
import { DemoFeedbackService } from "@/modules/demo-feedback/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const actionSet = new Set<string>(demoFeedbackActions);

export interface DemoFeedbackUpdateService {
  update(id: string, update: DemoFeedbackTriageUpdate): Promise<unknown>;
}

export async function patchDemoFeedbackRequest(
  request: Request,
  context: RouteContext,
  service: DemoFeedbackUpdateService = new DemoFeedbackService(),
  roleResolver: (headers: Headers) => Promise<string[]> = resolvePlatformRoles,
) {
  try {
    assertPlatformStaffWorkspaceAccess(await roleResolver(request.headers));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Body must be a JSON object.", 400);
  }

  const payload = body as Record<string, unknown>;
  const update: DemoFeedbackTriageUpdate = {};

  if (payload.processed !== undefined) {
    if (typeof payload.processed !== "boolean") {
      return jsonError("processed must be a boolean.", 400);
    }

    update.processed = payload.processed;
  }

  if (payload.action !== undefined) {
    if (payload.action !== null && (typeof payload.action !== "string" || !actionSet.has(payload.action))) {
      return jsonError("action is not allowed.", 400);
    }

    update.action = payload.action as DemoFeedbackTriageUpdate["action"];
  }

  try {
    const { id } = await context.params;
    const feedback = await service.update(id, update);
    return jsonOk({ feedback });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update feedback.";
    if (message.includes("At least one update field")) {
      return jsonError(message, 400);
    }
    if (message.includes("not found")) {
      return jsonError(message, 404);
    }

    return jsonError("Unable to update feedback.", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  return patchDemoFeedbackRequest(request, context);
}
