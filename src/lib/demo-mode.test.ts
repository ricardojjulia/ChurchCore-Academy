import assert from "node:assert/strict";
import test from "node:test";
import { isDemoModeEnabledClient, isDemoModeEnabledServer } from "@/lib/demo-mode";

const originalServer = process.env.DEMO_MODE_ENABLED;
const originalClient = process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED;

test.after(() => {
  process.env.DEMO_MODE_ENABLED = originalServer;
  process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED = originalClient;
});

test("demo mode helpers return false when disabled", () => {
  process.env.DEMO_MODE_ENABLED = "false";
  process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED = "false";

  assert.equal(isDemoModeEnabledServer(), false);
  assert.equal(isDemoModeEnabledClient(), false);
});

test("demo mode helpers return true when enabled", () => {
  process.env.DEMO_MODE_ENABLED = "true";
  process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED = "true";

  assert.equal(isDemoModeEnabledServer(), true);
  assert.equal(isDemoModeEnabledClient(), true);
});
