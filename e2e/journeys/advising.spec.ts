import { expect, test } from "@playwright/test";
import { storageStateFor } from "../helpers";

test("an advisor sees only their assigned caseload and can open existing signal workflow", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("advisor") });
  const page = await context.newPage();
  await page.goto("/admin/advising", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Advisor Caseload" })).toBeVisible();
  await expect(page.getByRole("table").getByText("E2E Learner", { exact: true })).toBeVisible();
  await expect(page.getByText("Lena Rivera", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No degree plan", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Advisor" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open signals" })).toBeVisible();
  await context.close();
});

test("a registrar can select an advisor and inspect the same caseload", async ({ browser }) => {
  const context = await browser.newContext({ storageState: storageStateFor("registrar") });
  const page = await context.newPage();
  await page.goto("/admin/advising", { waitUntil: "networkidle" });

  await page.getByRole("combobox", { name: "Advisor" }).selectOption("person-e2e-advisor");
  await page.getByRole("button", { name: "View caseload" }).click();
  await expect(page.getByRole("table").getByText("E2E Learner", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open record" })).toBeVisible();
  await context.close();
});
