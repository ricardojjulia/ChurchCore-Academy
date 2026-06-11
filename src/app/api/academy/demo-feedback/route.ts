import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { isDemoModeEnabledServer } from "@/lib/demo-mode";
import { DemoFeedbackService } from "@/modules/demo-feedback/service";

export interface DemoFeedbackSubmitService {
  submitFromJson(json: unknown): Promise<{ status: "accepted" | "rate_limited" }>;
}

export async function submitDemoFeedbackRequest(
  request: Request,
  service: DemoFeedbackSubmitService = new DemoFeedbackService(),
) {
  if (!isDemoModeEnabledServer()) {
    return jsonError("Demo feedback is disabled.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }

  try {
    const result = await service.submitFromJson(body);

    if (result.status === "rate_limited") {
      return jsonError("Too many feedback submissions. Please retry shortly.", 429);
    }

    return jsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected feedback error.";

    if (
      message.includes("must") ||
      message.includes("allowed") ||
      message.includes("between") ||
      message.includes("JSON") ||
      message.includes("UUID")
    ) {
      return jsonError(message, 400);
    }

    return jsonError("Unable to store feedback right now.", 500);
  }
}

export async function POST(request: Request) {
  return submitDemoFeedbackRequest(request);
}
