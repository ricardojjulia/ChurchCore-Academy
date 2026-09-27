import { expect, request, test, type APIResponse } from "@playwright/test";
import { storageStateFor } from "../helpers";

const tag = Date.now().toString(36).toUpperCase();
let customReportId = "";

async function ok(response: APIResponse, what: string) {
  const body = await response.text();
  expect(response.status(), `${what}: ${body.slice(0, 300)}`).toBeLessThan(300);
  return body ? JSON.parse(body) : {};
}

test("staff save and export a constrained custom report, without cross-tenant leakage", async ({ baseURL, browser }) => {
  const registrar = await request.newContext({ baseURL, storageState: storageStateFor("registrar") });
  const created = await ok(await registrar.post("/api/academy/reports", {
    data: {
      name: `E2E Active Enrollment ${tag}`,
      baseReportId: "enrollment",
      selectedColumns: ["studentNumber", "studentName", "status"],
      filters: [{ columnKey: "status", operator: "not_empty" }],
    },
  }), "create custom report");
  customReportId = created.customReport?.id ?? "";
  expect(customReportId).toBeTruthy();

  const dashboard = await ok(await registrar.get("/api/academy/reports"), "read reports dashboard");
  expect((dashboard.customReports as Array<Record<string, unknown>>)
    .some((report) => report.id === customReportId && report.name === `E2E Active Enrollment ${tag}`)).toBe(true);

  const csv = await registrar.get(`/api/academy/reports?customReportId=${customReportId}&format=csv`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("Student Number,Student Name,Status");

  const context = await browser.newContext({ storageState: storageStateFor("registrar") });
  const page = await context.newPage();
  await page.goto("/admin/reporting", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Saved Custom Reports" })).toBeVisible();
  await expect(page.getByText(`E2E Active Enrollment ${tag}`)).toBeVisible();
  await context.close();

  await registrar.dispose();

  const student = await request.newContext({ baseURL, storageState: storageStateFor("student") });
  const denied = await student.post("/api/academy/reports", {
    data: {
      name: `Student Report ${tag}`,
      baseReportId: "enrollment",
      selectedColumns: ["studentNumber"],
    },
    failOnStatusCode: false,
  });
  expect(denied.status()).toBe(403);
  await student.dispose();

  const otherTenant = await request.newContext({ baseURL, storageState: storageStateFor("otherTenantAdmin") });
  const otherExport = await otherTenant.get(`/api/academy/reports?customReportId=${customReportId}&format=csv`, {
    failOnStatusCode: false,
  });
  expect(otherExport.status()).toBe(404);
  await otherTenant.dispose();
});
