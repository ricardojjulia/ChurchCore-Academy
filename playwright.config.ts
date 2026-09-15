import { defineConfig } from "@playwright/test";

// Manually-run local verification, not a CI gate — see docs/runbooks/e2e-browser-verification.md
// for required setup (local Supabase, dev server on :3200, seeded demo personas) and how to run
// via `npm run test:e2e`.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  use: {
    baseURL: "http://localhost:3200",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
