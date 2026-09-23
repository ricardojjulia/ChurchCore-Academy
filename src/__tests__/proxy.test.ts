import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { isPublicPath, proxy } from "@/proxy";

// Regression: the proxy used to redirect every path except /login to the login page, which
// silently blocked the public applicant portal, Vercel cron jobs, and the Stripe webhook.
const passesThrough = (response: Response) => response.headers.get("x-middleware-next") === "1";

for (const path of [
  "/apply",
  "/apply/status",
  "/api/public/apply",
  "/api/public/apply/programs",
  "/api/public/apply/status",
  "/api/public/apply/documents/item-1/upload-url",
  "/api/cron/email-worker",
  "/api/cron/scheduled-reports",
  "/api/cron/oneroster-delivery",
  "/api/academy/billing/stripe-webhook",
  "/login",
]) {
  test(`public path reaches its own handler without a session: ${path}`, async () => {
    assert.equal(isPublicPath(path), true);
    assert.equal(passesThrough(await proxy(new NextRequest(`https://academy.example.test${path}`))), true);
  });
}

for (const path of ["/admin", "/student", "/applyx", "/api/academy/students", "/api/publicity", "/api/academy/billing/stripe-webhooks"]) {
  test(`protected path is not public: ${path}`, () => {
    assert.equal(isPublicPath(path), false);
  });
}

test("an unauthenticated API request gets a 401 JSON response, not a login redirect", async () => {
  const response = await proxy(new NextRequest("https://academy.example.test/api/academy/students"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Authentication required." });
});

test("an unauthenticated page request is still redirected to login", async () => {
  const response = await proxy(new NextRequest("https://academy.example.test/admin/students"));
  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /\/login\?next=%2Fadmin%2Fstudents$/);
});
