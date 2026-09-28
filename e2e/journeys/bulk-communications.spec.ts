import { expect, request, test, type APIResponse } from "@playwright/test";
import { storageStateFor } from "../helpers";

const tag = Date.now().toString(36).toUpperCase();

async function ok(response: APIResponse, what: string) {
  const body = await response.text();
  expect(response.status(), `${what}: ${body.slice(0, 300)}`).toBeLessThan(300);
  return body ? JSON.parse(body) : {};
}

test("staff queue manual bulk email without exposing SMS or student writes", async ({ baseURL, browser }) => {
  const registrar = await request.newContext({ baseURL, storageState: storageStateFor("registrar") });
  const created = await ok(await registrar.post("/api/academy/communications", {
    data: {
      action: "create",
      templateKey: "manual_bulk_email",
      audience: { type: "role", roles: ["student"] },
      channels: ["email"],
      variables: {
        subject: `E2E Bulk Update ${tag}`,
        body: "Please review this academy update.",
      },
      sourceType: "manual",
      sourceId: `manual-bulk-email-${tag}`,
      idempotencyKey: `bulk-${tag}`,
      essential: false,
    },
  }), "create bulk email");
  expect(Array.isArray(created)).toBe(true);
  expect(created.length).toBeGreaterThan(0);
  expect(created.every((message: Record<string, unknown>) =>
    message.channel === "email" && message.templateKey === "manual_bulk_email"
  )).toBe(true);

  const sms = await registrar.post("/api/academy/communications", {
    data: {
      action: "create",
      templateKey: "manual_bulk_email",
      audience: { type: "role", roles: ["student"] },
      channels: ["sms"],
      variables: { subject: "SMS", body: "Not approved." },
      sourceType: "manual",
      sourceId: `manual-bulk-sms-${tag}`,
      idempotencyKey: `bulk-sms-${tag}`,
      essential: false,
    },
    failOnStatusCode: false,
  });
  expect(sms.status()).toBe(400);

  const context = await browser.newContext({ storageState: storageStateFor("registrar") });
  const page = await context.newPage();
  await page.goto("/admin/communications", { waitUntil: "networkidle" });
  await expect(page.getByRole("option", { name: "Manual bulk email" })).toBeAttached();
  await expect(page.getByText(`E2E Bulk Update ${tag}`).first()).toBeVisible();
  await context.close();
  await registrar.dispose();

  const student = await request.newContext({ baseURL, storageState: storageStateFor("student") });
  const denied = await student.post("/api/academy/communications", {
    data: {
      action: "create",
      templateKey: "manual_bulk_email",
      audience: { type: "role", roles: ["student"] },
      channels: ["email"],
      variables: { subject: "Student send", body: "Should be denied." },
      sourceType: "manual",
      sourceId: `manual-bulk-student-${tag}`,
      idempotencyKey: `bulk-student-${tag}`,
      essential: false,
    },
    failOnStatusCode: false,
  });
  expect(denied.status()).toBe(403);
  await student.dispose();
});
