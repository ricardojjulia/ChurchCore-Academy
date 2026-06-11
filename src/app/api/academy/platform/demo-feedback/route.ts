import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { assertPlatformStaffWorkspaceAccess } from "@/modules/academy-auth/policy";
import { resolvePlatformRoles } from "@/modules/academy-auth/platform-request-context";
import { demoFeedbackCategories, DemoFeedbackTriageFilters } from "@/modules/demo-feedback/types";
import { DemoFeedbackService } from "@/modules/demo-feedback/service";

export interface DemoFeedbackListService {
  list(filters: DemoFeedbackTriageFilters): Promise<unknown[]>;
}

const categorySet = new Set<string>(demoFeedbackCategories);

export async function listDemoFeedbackRequest(
  request: Request,
  service: DemoFeedbackListService = new DemoFeedbackService(),
) {
  try {
    assertPlatformStaffWorkspaceAccess(await resolvePlatformRoles(request.headers));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Forbidden", 403);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "open";
  const category = url.searchParams.get("category") ?? undefined;
  const identity = url.searchParams.get("identity") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  if (!["open", "done", "all"].includes(status)) {
    return jsonError("status must be open, done, or all.", 400);
  }

  if (category && !categorySet.has(category)) {
    return jsonError("category is not allowed.", 400);
  }

  const filters: DemoFeedbackTriageFilters = {
    status: status as DemoFeedbackTriageFilters["status"],
    category: category as DemoFeedbackTriageFilters["category"],
    identity,
    from,
    to,
  };

  try {
    const feedback = await service.list(filters);
    return jsonOk({ feedback });
  } catch {
    return jsonError("Unable to load triage feedback.", 500);
  }
}

export async function GET(request: Request) {
  return listDemoFeedbackRequest(request);
}
