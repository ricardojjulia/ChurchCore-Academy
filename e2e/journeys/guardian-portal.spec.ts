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

test("the guardian portal shows guardian navigation, not the staff sidebar (#188)", async ({ page }) => {
  await loginAs(page, PERSONAS.guardian);
  const nav = page.getByRole("navigation", { name: "Guardian navigation" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "Messages" })).toBeVisible();
  for (const staffSection of ["Admissions", "Registrar", "System"]) {
    await expect(page.getByRole("button", { name: staffSection })).toHaveCount(0);
  }
});

test("the guardian can open their own child's page", async ({ browser }) => {
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
