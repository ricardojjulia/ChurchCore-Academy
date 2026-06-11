import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoFeedbackFingerprint } from "@/modules/demo-feedback/fingerprint";

test("equivalent normalized reports share a fingerprint", () => {
  const left = buildDemoFeedbackFingerprint({
    sessionId: "3bf4ca1f-66b0-458f-89a4-bfd74c965cbf",
    route: " /students/stu-maya-bennett ",
    category: "ERROR",
    errorMessage: "  Enrollment   failed   unexpectedly  ",
    note: null,
    breadcrumbs: ["/"],
    demoVersion: "dev",
    sessionDurationSeconds: 10,
  });

  const right = buildDemoFeedbackFingerprint({
    sessionId: "3bf4ca1f-66b0-458f-89a4-bfd74c965cbf",
    route: "/students/stu-maya-bennett",
    category: "ERROR",
    errorMessage: "enrollment failed unexpectedly",
    note: null,
    breadcrumbs: ["/"],
    demoVersion: "dev",
    sessionDurationSeconds: 10,
  });

  assert.equal(left, right);
});

test("different manual notes produce different fingerprints", () => {
  const shared = {
    sessionId: "3bf4ca1f-66b0-458f-89a4-bfd74c965cbf",
    route: "/students/stu-maya-bennett",
    category: "IMPROVEMENT" as const,
    errorMessage: null,
    breadcrumbs: ["/"],
    demoVersion: "dev",
    sessionDurationSeconds: 10,
  };

  const left = buildDemoFeedbackFingerprint({ ...shared, note: "Please add export CSV" });
  const right = buildDemoFeedbackFingerprint({ ...shared, note: "Please add bulk archive" });

  assert.notEqual(left, right);
});
