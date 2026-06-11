import assert from "node:assert/strict";
import test from "node:test";
import { buildClientDemoFeedbackPayload } from "@/modules/demo-feedback/client-payload";

test("builds browser payload with contextual fields and without identity", () => {
  const payload = buildClientDemoFeedbackPayload({
    category: "BUG",
    note: "Course list did not refresh",
    session: {
      sessionId: "3bf4ca1f-66b0-458f-89a4-bfd74c965cbf",
      breadcrumbs: ["/", "/courses"],
      route: "/courses",
      demoVersion: "2026.06.11",
      sessionDurationSeconds: 52,
    },
  });

  assert.deepEqual(payload, {
    sessionId: "3bf4ca1f-66b0-458f-89a4-bfd74c965cbf",
    route: "/courses",
    category: "BUG",
    errorMessage: undefined,
    note: "Course list did not refresh",
    breadcrumbs: ["/", "/courses"],
    demoVersion: "2026.06.11",
    sessionDurationSeconds: 52,
  });

  assert.equal("userEmail" in payload, false);
  assert.equal("userRole" in payload, false);
  assert.equal("fingerprint" in payload, false);
});
