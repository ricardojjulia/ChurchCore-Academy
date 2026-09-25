import { expect, test } from "@playwright/test";
import { storageStateFor } from "../helpers";

// The public applicant portal, end to end: a signed-out applicant applies, checks status with
// their token, and admissions staff see the application in the queue. This whole path was
// unreachable before the proxy public-route fix (#168).
test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);
const applicantName = `E2E Applicant ${runId}`;
const applicantEmail = `applicant.${runId}@e2e.churchcore.invalid`;
let statusToken = "";

test("a signed-out applicant can submit an application", async ({ page }) => {
  await page.goto("/apply", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Apply for admission" })).toBeVisible();

  await page.locator("#legalName").fill(applicantName);
  await page.locator("#email").fill(applicantEmail);
  const programSelect = page.locator("#programId");
  await expect(programSelect.locator("option")).not.toHaveCount(1); // more than the placeholder
  await programSelect.selectOption({ index: 1 });
  await page.locator("#personalStatement").fill(
    "I am applying to deepen my study of scripture and prepare for ministry in my local church community.",
  );
  await page.getByRole("button", { name: /submit/i }).click();

  await expect(page.getByRole("heading", { name: "Application submitted" })).toBeVisible();
  statusToken = (await page.locator(".apply-portal-token").innerText()).trim();
  expect(statusToken).toMatch(/^[0-9a-f-]{36}$/);
});

test("the applicant can check status with their token", async ({ page }) => {
  expect(statusToken, "depends on the submission test").not.toBe("");
  await page.goto("/apply/status", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Enter your status token").fill(statusToken);
  await page.getByRole("button", { name: /check/i }).click();
  await expect(page.getByRole("heading", { name: "Application status" })).toBeVisible();
});

test("an unknown token is rejected without leaking anything", async ({ page }) => {
  await page.goto("/apply/status", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Enter your status token").fill("00000000-0000-4000-8000-000000000000");
  await page.getByRole("button", { name: /check/i }).click();
  await expect(page.getByText("No application found for that token.")).toBeVisible();
});

test("admissions staff see the new application in the queue", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("admissions") });
  const page = await context.newPage();
  await page.goto("/admin/admissions", { waitUntil: "networkidle" });
  await expect(page.getByText(applicantName)).toBeVisible();
  await context.close();
});

test("another institution's admin does not see it", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("otherTenantAdmin") });
  const page = await context.newPage();
  await page.goto("/admin/admissions", { waitUntil: "networkidle" });
  await expect(page.getByText(applicantName)).toHaveCount(0);
  await context.close();
});
