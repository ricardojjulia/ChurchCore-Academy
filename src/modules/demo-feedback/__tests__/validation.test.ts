import assert from "node:assert/strict";
import test from "node:test";
import { parseDemoFeedbackJsonBody } from "@/modules/demo-feedback/validation";

const valid = {
  sessionId: "3bf4ca1f-66b0-458f-89a4-bfd74c965cbf",
  route: "/students/stu-maya-bennett",
  category: "BUG",
  errorMessage: "Unexpected enrollment mismatch",
  note: "This issue appeared after I switched terms.",
  breadcrumbs: ["/", "/students", "/students/stu-maya-bennett"],
  demoVersion: "2026.06.11",
  sessionDurationSeconds: 41,
};

test("validates and normalizes demo feedback payload", () => {
  const parsed = parseDemoFeedbackJsonBody(valid);

  assert.equal(parsed.category, "BUG");
  assert.equal(parsed.note, "This issue appeared after I switched terms.");
  assert.equal(parsed.sessionDurationSeconds, 41);
});

test("ignores client identity and fingerprint fields", () => {
  const parsed = parseDemoFeedbackJsonBody({
    ...valid,
    userEmail: "forged@example.com",
    userRole: "platform_admin",
    fingerprint: "fake",
  } as unknown as Record<string, unknown>);

  assert.equal("userEmail" in parsed, false);
  assert.equal("userRole" in parsed, false);
  assert.equal("fingerprint" in parsed, false);
});

test("enforces category allowlist", () => {
  assert.throws(
    () => parseDemoFeedbackJsonBody({ ...valid, category: "OTHER" }),
    /category is not allowed/,
  );
});

test("enforces field bounds", () => {
  assert.throws(
    () => parseDemoFeedbackJsonBody({ ...valid, route: "x".repeat(501) }),
    /route must be between 1 and 500 characters/,
  );

  assert.throws(
    () => parseDemoFeedbackJsonBody({ ...valid, note: "n".repeat(2001) }),
    /note must be at most 2000 characters/,
  );

  assert.throws(
    () => parseDemoFeedbackJsonBody({ ...valid, errorMessage: "e".repeat(4001) }),
    /errorMessage must be at most 4000 characters/,
  );

  assert.throws(
    () => parseDemoFeedbackJsonBody({ ...valid, breadcrumbs: new Array(6).fill("/") }),
    /breadcrumbs must contain at most 5 entries/,
  );
});

test("enforces session duration range and integer type", () => {
  assert.throws(
    () => parseDemoFeedbackJsonBody({ ...valid, sessionDurationSeconds: -1 }),
    /sessionDurationSeconds must be between 0 and 2592000/,
  );

  assert.throws(
    () => parseDemoFeedbackJsonBody({ ...valid, sessionDurationSeconds: 2592001 }),
    /sessionDurationSeconds must be between 0 and 2592000/,
  );

  assert.throws(
    () => parseDemoFeedbackJsonBody({ ...valid, sessionDurationSeconds: 1.5 }),
    /sessionDurationSeconds must be an integer/,
  );
});
