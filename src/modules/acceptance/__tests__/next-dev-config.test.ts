import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../../../../next.config";

test("Next dev config allows the loopback IP origin used for local browser checks", () => {
  assert.ok(
    nextConfig.allowedDevOrigins?.includes("127.0.0.1"),
    "Expected 127.0.0.1 to be allowed so Next dev hydrates when opened from the loopback IP.",
  );
});
