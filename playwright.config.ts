import { defineConfig } from "@playwright/test";

// Full e2e suite — see docs/testing/e2e-suite.md. `npm run test:full` provisions a disposable
// Supabase, seeds it, builds and serves the app, then runs this config. Running `npx playwright
// test` directly expects that environment to already be up at E2E_BASE_URL.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "e2e/report" }], ["github"]]
    : [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3300",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
