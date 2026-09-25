import { expect, test } from "@playwright/test";
import { loginAs, PERSONAS, storageStateFor } from "../helpers";

// The guardian portal: Marisol Rivera (guardian@) is linked to Lena Rivera in the seed.
test.describe.configure({ mode: "serial" });

const CHILD = "person-lena-rivera";
const NOT_MY_CHILD = "person-naomi-price";

test("a guardian signs in and lands on the guardian portal", async ({ page }) => {
  await loginAs(page, PERSONAS.guardian);
  await expect(page).toHaveURL(/\/guardian$/);
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
});

test("the guardian can open their own child's page", async ({ browser }) => {
  // Known issue #170: the child page queries a column that doesn't exist and crashes. This test
  // is expected to fail until that's fixed; Playwright flags it when it starts passing.
  test.fail(true, "#170 — /guardian/[studentId] queries cs.course_code, which doesn't exist");
  const context = await browser.newContext({ storageState: storageStateFor("guardian") });
  const page = await context.newPage();
  await page.goto(`/guardian/${CHILD}`, { waitUntil: "networkidle" });
  await expect(page.getByText("Unable to load this page")).toHaveCount(0);
  await expect(page.getByText("Lena").first()).toBeVisible();
  await context.close();
});

test("the guardian cannot read a student who isn't their child", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("guardian") });
  const response = await context.request.get(`/api/academy/guardian/students/${NOT_MY_CHILD}`, { failOnStatusCode: false });
  expect([403, 404]).toContain(response.status());
  await context.close();
});

test("the guardian is kept out of the staff app and the student portal", async ({ page }) => {
  await loginAs(page, PERSONAS.guardian);
  await page.goto("/admin/students", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/guardian$/);
  const roster = await page.request.get("/api/academy/students", { failOnStatusCode: false });
  expect(roster.status()).toBe(403);
});
