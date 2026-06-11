import { buildClientDemoFeedbackPayload } from "@/modules/demo-feedback/client-payload";
import { DemoFeedbackCategory } from "@/modules/demo-feedback/types";

interface DemoSessionSnapshot {
  sessionId: string;
  breadcrumbs: string[];
  sessionDurationSeconds: number;
  route: string;
  demoVersion: string;
}

export async function submitDemoFeedback(
  category: DemoFeedbackCategory,
  session: DemoSessionSnapshot,
  options?: { note?: string; errorMessage?: string },
) {
  const payload = buildClientDemoFeedbackPayload({
    category,
    note: options?.note,
    errorMessage: options?.errorMessage,
    session,
  });

  const response = await fetch("/api/academy/demo-feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.ok;
}

export async function reportCapturedDemoError(session: DemoSessionSnapshot, errorMessage: string) {
  try {
    await submitDemoFeedback("ERROR", session, { errorMessage });
  } catch {
    // Intentionally swallow secondary telemetry errors.
  }
}
