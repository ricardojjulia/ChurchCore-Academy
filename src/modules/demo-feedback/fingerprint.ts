import { createHash } from "node:crypto";
import { DemoFeedbackSubmission } from "@/modules/demo-feedback/types";
import { normalizeForFingerprint } from "@/modules/demo-feedback/normalize";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function buildDemoFeedbackFingerprint(input: DemoFeedbackSubmission) {
  const route = normalizeForFingerprint(input.route);
  const category = normalizeForFingerprint(input.category);
  const payload = input.note
    ? normalizeForFingerprint(input.note)
    : normalizeForFingerprint(input.errorMessage);

  return sha256Hex([route, category, payload].join("|"));
}

export function buildRateLimitKey(sessionId: string) {
  return sha256Hex(sessionId.trim().toLowerCase());
}
